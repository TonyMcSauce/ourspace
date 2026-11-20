/**
 * cloud.js
 * Firebase connection: sign-in, live sync and presence.
 *
 * Only active when CONFIG.firebase.apiKey is filled in. The Firebase
 * SDK is loaded on demand, so demo mode stays light.
 *
 * Firestore layout (everything sits under one shared space):
 *   spaces/{spaceId}/messages/{id}
 *   spaces/{spaceId}/notes/{id}
 *   spaces/{spaceId}/memories/{id}
 *   spaces/{spaceId}/journey/{id}
 *   spaces/{spaceId}/jar/{id}           love jar slips
 *   spaces/{spaceId}/capsules/{id}      time capsules
 *   spaces/{spaceId}/lists/{id}         shared lists
 *   spaces/{spaceId}/listItems/{id}     items on those lists
 *   spaces/{spaceId}/meta/favourites
 *   spaces/{spaceId}/meta/song
 *   spaces/{spaceId}/meta/countdown
 *   spaces/{spaceId}/meta/profile       { startDate }
 *   spaces/{spaceId}/meta/wallpaper     shared chat wallpaper
 *   spaces/{spaceId}/meta/presence      { [userId]: lastSeenMs }
 */

const Cloud = (() => {
  const SDK = "https://www.gstatic.com/firebasejs/10.14.1/";
  const COLLECTIONS = ["messages", "notes", "memories", "journey", "jar", "capsules", "lists", "listItems"];
  const DOCS = ["favourites", "song", "countdown", "profile", "wallpaper", "avatars", "presence"];
  // Only the most recent messages are kept live; older ones load on request.
  const MESSAGE_WINDOW = 300;
  const BATCH_LIMIT = 450; // Firestore allows 500 writes per batch
  const HEARTBEAT_MS = 60 * 1000;

  const cfg = CONFIG.firebase || {};
  const enabled = Boolean(cfg.apiKey && cfg.projectId);

  let auth = null;
  let db = null;
  let userId = null;
  let unsubs = [];
  let heartbeat = null;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const el = document.createElement("script");
      el.src = src;
      el.onload = resolve;
      el.onerror = () => reject(new Error("Couldn't reach Firebase. Check your connection."));
      document.head.appendChild(el);
    });
  }

  function space() {
    return db.collection("spaces").doc(CONFIG.spaceId || "us");
  }

  async function sha256(text) {
    const bytes = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  }

  async function userIdForEmail(email) {
    const hash = await sha256(String(email || "").trim().toLowerCase());
    const match = Object.values(CONFIG.users).find((u) => u.emailHash === hash);
    return match ? match.id : null;
  }

  // Firestore rejects `undefined`; a JSON round-trip drops those keys.
  function clean(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function reportError(err) {
    console.error("Cloud:", err);
    const offline = err && (err.code === "unavailable" || !navigator.onLine);
    if (typeof Toast !== "undefined") {
      Toast.show(
        offline
          ? "You're offline. Changes will sync when you're back."
          : err && err.code === "permission-denied"
          ? "This account doesn't have access to your space."
          : "Couldn't save that. Please try again."
      );
    }
  }

  // ---------------------------------------------------------------
  // Remote adapter for storage.js
  // ---------------------------------------------------------------
  const adapter = {
    session() {
      return userId ? { userId } : null;
    },
    write(kind, next, prev) {
      if (!db || !userId) return;
      if (COLLECTIONS.includes(kind)) {
        const col = space().collection(kind);
        const before = new Map((prev || []).map((item) => [item.id, JSON.stringify(item)]));
        const after = new Set();
        const ops = [];
        (next || []).forEach((item) => {
          if (!item || !item.id) return;
          after.add(item.id);
          if (before.get(item.id) !== JSON.stringify(item)) ops.push((b) => b.set(col.doc(String(item.id)), clean(item)));
        });
        before.forEach((_, id) => {
          if (!after.has(id)) ops.push((b) => b.delete(col.doc(String(id))));
        });
        for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
          const batch = db.batch();
          ops.slice(i, i + BATCH_LIMIT).forEach((op) => op(batch));
          batch.commit().catch(reportError);
        }
        return;
      }
      if (DOCS.includes(kind)) {
        space().collection("meta").doc(kind).set(clean(next || {})).catch(reportError);
      }
    },
  };

  // ---------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------
  async function init() {
    if (!enabled) return;
    await loadScript(SDK + "firebase-app-compat.js");
    await Promise.all([loadScript(SDK + "firebase-auth-compat.js"), loadScript(SDK + "firebase-firestore-compat.js")]);
    firebase.initializeApp(cfg);
    auth = firebase.auth();
    db = firebase.firestore();
    // Offline cache: instant loads and offline reading/writing.
    try {
      await db.enablePersistence({ synchronizeTabs: true });
    } catch (err) {
      console.info("Cloud: offline cache unavailable in this browser.", err && err.code);
    }
    Storage.useRemote(adapter);
  }

  function currentUser() {
    return new Promise((resolve) => {
      const off = auth.onAuthStateChanged((user) => {
        off();
        resolve(user);
      });
    });
  }

  function subscribeAll() {
    const firstLoads = [];
    COLLECTIONS.forEach((kind) => {
      firstLoads.push(
        new Promise((resolve) => {
          const query =
            kind === "messages"
              ? space().collection(kind).orderBy("ts", "desc").limit(MESSAGE_WINDOW)
              : space().collection(kind);
          const off = query
            .onSnapshot(
              (snap) => {
                const docs = snap.docs.map((d) => d.data());
                if (kind === "messages") {
                  hasOlder = snap.size >= MESSAGE_WINDOW;
                  // A full window is only the newest slice: keep older
                  // messages already loaded on this phone.
                  Storage.receive(kind, docs, hasOlder ? { keepOlderThan: Math.min(...docs.map((m) => m.ts || 0)) } : undefined);
                } else Storage.receive(kind, docs);
                resolve();
              },
              (err) => {
                reportError(err);
                resolve();
              }
            );
          unsubs.push(off);
        })
      );
    });
    DOCS.forEach((kind) => {
      firstLoads.push(
        new Promise((resolve) => {
          const off = space()
            .collection("meta")
            .doc(kind)
            .onSnapshot(
              (doc) => {
                Storage.receive(kind, doc.exists ? doc.data() : null);
                resolve();
              },
              (err) => {
                reportError(err);
                resolve();
              }
            );
          unsubs.push(off);
        })
      );
    });
    return Promise.all(firstLoads);
  }

  // ---------------------------------------------------------------
  // Older messages and the media store
  // ---------------------------------------------------------------
  let hasOlder = false;

  async function loadOlderMessages(beforeTs, count = 150) {
    if (!db || !userId) return 0;
    const snap = await space().collection("messages").where("ts", "<", beforeTs).orderBy("ts", "desc").limit(count).get();
    const docs = snap.docs.map((d) => d.data());
    if (snap.size < count) hasOlder = false;
    Storage.mergeMessages(docs);
    return docs.length;
  }

  function putMedia(id, data) {
    if (!db || !userId) return;
    space().collection("media").doc(id).set({ data, by: userId, ts: Date.now() }).catch(reportError);
  }

  async function getMedia(id) {
    if (!db) return "";
    const ref = space().collection("media").doc(id);
    // The offline cache first (free and instant), the server if needed.
    try {
      const cached = await ref.get({ source: "cache" });
      if (cached.exists) return cached.data().data;
    } catch {}
    const doc = await ref.get();
    return doc.exists ? doc.data().data : "";
  }

  function deleteMedia(id) {
    if (!db || !userId) return;
    space().collection("media").doc(id).delete().catch(() => {});
  }

  // Presence: when you were last here, and whether the app is open now.
  // The notifier uses "open" to stay quiet while you're already looking.
  function beat(open = document.visibilityState === "visible") {
    if (!db || !userId) return;
    if (open && document.visibilityState !== "visible") return;
    space()
      .collection("meta")
      .doc("presence")
      .set({ [userId]: { t: Date.now(), on: open } }, { merge: true })
      .catch(() => {});
  }

  function onVisibility() {
    beat(document.visibilityState === "visible");
  }
  const onPageHide = () => beat(false);

  // ---------------------------------------------------------------
  // Notifications (sent by the Cloudflare notifier, see cloudflare/)
  // ---------------------------------------------------------------
  const push = CONFIG.push || {};
  const pushReady = () => Boolean(enabled && push.workerUrl && push.vapidKey);

  /** Ask the notifier to tap the other phone. Fire and forget. */
  async function notify(kind) {
    if (!pushReady() || !userId || !auth || !auth.currentUser) return;
    try {
      const idToken = await auth.currentUser.getIdToken();
      await fetch(`${push.workerUrl}/notify`, {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
        keepalive: true,
      });
    } catch (err) {
      console.info("Notification not sent", err);
    }
  }

  /**
   * Read receipts: only the status (and read time) of the other person's
   * messages, written on their own so nothing else can hold them back.
   */
  const receipting = new Set();
  function markMessages(ids, status) {
    if (!db || !userId || !ids.length) return;
    const col = space().collection("messages");
    const fresh = ids.filter((id) => !receipting.has(`${id}:${status}`));
    if (!fresh.length) return;
    const now = Date.now();
    for (let i = 0; i < fresh.length; i += BATCH_LIMIT) {
      const batch = db.batch();
      fresh.slice(i, i + BATCH_LIMIT).forEach((id) => {
        receipting.add(`${id}:${status}`);
        batch.update(col.doc(String(id)), status === "read" ? { status, readAt: now } : { status });
      });
      batch.commit().catch((err) => {
        fresh.forEach((id) => receipting.delete(`${id}:${status}`));
        console.info("Read receipt not saved", err);
      });
    }
  }

  /**
   * Call relay (TURN) details from the notifier, so calls connect even
   * when both networks block direct connections. Cached for a few hours;
   * an empty list just means direct connections only.
   */
  let iceCache = { servers: null, until: 0 };
  async function iceServers() {
    if (iceCache.servers && Date.now() < iceCache.until) return iceCache.servers;
    if (!push.workerUrl || !auth || !auth.currentUser) return [];
    try {
      const idToken = await auth.currentUser.getIdToken();
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 4000);
      const res = await fetch(`${push.workerUrl}/ice`, {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      const data = res.ok ? await res.json() : {};
      const servers = Array.isArray(data.iceServers) ? data.iceServers : [];
      iceCache = { servers, until: Date.now() + (servers.length ? 4 * 3600 * 1000 : 10 * 60 * 1000) };
      return servers;
    } catch (err) {
      console.info("No call relay", err);
      return [];
    }
  }

  function pushSupport() {
    if (!pushReady()) return "unconfigured";
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
      return iOS && !standalone ? "needs-home-screen" : "unsupported";
    }
    if (Notification.permission === "denied") return "denied";
    return "ok";
  }

  async function messaging() {
    if (!window.firebase.messaging) await loadScript(SDK + "firebase-messaging-compat.js");
    return firebase.messaging();
  }

  async function currentPushToken() {
    const registration = await navigator.serviceWorker.ready;
    return (await messaging()).getToken({ vapidKey: push.vapidKey, serviceWorkerRegistration: registration });
  }

  async function savePushToken(token) {
    await space()
      .collection("meta")
      .doc("push")
      .set({ [userId]: { tokens: firebase.firestore.FieldValue.arrayUnion(token), at: Date.now() } }, { merge: true });
    try {
      localStorage.setItem("ourspace_push_token", token);
    } catch {}
  }

  /** Turn notifications on for this phone. Must be called from a tap. */
  async function enablePush() {
    const support = pushSupport();
    if (support !== "ok") return support;
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return permission === "denied" ? "denied" : "dismissed";
    const token = await currentPushToken();
    if (!token) throw new Error("Couldn't register this phone for notifications.");
    await savePushToken(token);
    return "on";
  }

  async function disablePush() {
    let token = null;
    try {
      token = localStorage.getItem("ourspace_push_token");
      localStorage.removeItem("ourspace_push_token");
    } catch {}
    try {
      if (token) {
        await space()
          .collection("meta")
          .doc("push")
          .set({ [userId]: { tokens: firebase.firestore.FieldValue.arrayRemove(token), at: Date.now() } }, { merge: true });
      }
      await (await messaging()).deleteToken();
    } catch (err) {
      console.info("Couldn't fully remove this phone", err);
    }
  }

  function pushOn() {
    try {
      return Boolean(localStorage.getItem("ourspace_push_token")) && "Notification" in window && Notification.permission === "granted";
    } catch {
      return false;
    }
  }

  /** Tokens can change; keep this phone's up to date quietly. */
  async function refreshPush() {
    if (!pushReady() || !pushOn()) return;
    try {
      const token = await currentPushToken();
      if (token && token !== localStorage.getItem("ourspace_push_token")) await savePushToken(token);
    } catch (err) {
      console.info("Couldn't refresh notifications", err);
    }
  }

  async function start(user) {
    const id = await userIdForEmail(user.email);
    if (!id) {
      await auth.signOut();
      throw new Error("That account isn't one of the two in this space.");
    }
    userId = id;
    await subscribeAll();
    beat();
    heartbeat = setInterval(beat, HEARTBEAT_MS);
    setTimeout(() => {
      if (userId && typeof Media !== "undefined") Media.migrate();
    }, 4000);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    setTimeout(refreshPush, 6000);
  }

  function friendlyAuthError(err) {
    const code = (err && err.code) || "";
    if (/invalid-credential|wrong-password|user-not-found|invalid-login/.test(code)) return "That password doesn't match. Try again.";
    if (/too-many-requests/.test(code)) return "Too many tries. Wait a minute, then try again.";
    if (/network-request-failed/.test(code)) return "No connection. Check your internet and try again.";
    if (/invalid-email|missing-email/.test(code)) return "That doesn't look like an email address.";
    return (err && err.message) || "Couldn't sign in. Please try again.";
  }

  async function signIn(email, password) {
    email = String(email || "").trim();
    if (!email) throw new Error("Enter your email.");
    if (!password) throw new Error("Enter your password.");
    let cred;
    try {
      cred = await auth.signInWithEmailAndPassword(email, password);
    } catch (err) {
      throw new Error(friendlyAuthError(err));
    }
    await start(cred.user);
  }

  async function signOut() {
    // A signed-out phone shouldn't keep getting the other person's notifications.
    if (pushOn()) await disablePush();
    beat(false);
    unsubs.forEach((off) => off());
    unsubs = [];
    clearInterval(heartbeat);
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("pagehide", onPageHide);
    userId = null;
    Storage.clearCache();
    if (auth) await auth.signOut();
  }

  return {
    enabled,
    init,
    currentUser,
    start,
    signIn,
    signOut,
    isActive: () => enabled && !!userId,
    hasOlderMessages: () => hasOlder,
    loadOlderMessages,
    putMedia,
    getMedia,
    deleteMedia,
    notify,
    iceServers,
    markMessages,
    // For calls: the shared space and Firestore helpers.
    space: () => space(),
    db: () => db,
    me: () => userId,
    pushSupport,
    pushOn,
    enablePush,
    disablePush,
  };
})();
