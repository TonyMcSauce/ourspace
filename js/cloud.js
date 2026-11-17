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
 *   spaces/{spaceId}/meta/favourites
 *   spaces/{spaceId}/meta/song
 *   spaces/{spaceId}/meta/presence      { [userId]: lastSeenMs }
 */

const Cloud = (() => {
  const SDK = "https://www.gstatic.com/firebasejs/10.14.1/";
  const COLLECTIONS = ["messages", "notes", "memories", "journey"];
  const DOCS = ["favourites", "song", "presence"];
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
        const batch = db.batch();
        let ops = 0;
        (next || []).forEach((item) => {
          if (!item || !item.id) return;
          after.add(item.id);
          if (before.get(item.id) !== JSON.stringify(item)) {
            batch.set(col.doc(String(item.id)), clean(item));
            ops++;
          }
        });
        before.forEach((_, id) => {
          if (!after.has(id)) {
            batch.delete(col.doc(String(id)));
            ops++;
          }
        });
        if (ops) batch.commit().catch(reportError);
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
          const off = space()
            .collection(kind)
            .onSnapshot(
              (snap) => {
                Storage.receive(kind, snap.docs.map((d) => d.data()));
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

  function beat() {
    if (!db || !userId || document.visibilityState !== "visible") return;
    space()
      .collection("meta")
      .doc("presence")
      .set({ [userId]: Date.now() }, { merge: true })
      .catch(() => {});
  }

  function onVisibility() {
    if (document.visibilityState === "visible") beat();
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
    document.addEventListener("visibilitychange", onVisibility);
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
    unsubs.forEach((off) => off());
    unsubs = [];
    clearInterval(heartbeat);
    document.removeEventListener("visibilitychange", onVisibility);
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
  };
})();
