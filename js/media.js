/**
 * media.js
 * Photos and voice notes, kept apart from the records that use them.
 *
 * Why: lists like chat and memories are kept live by Firestore. If every
 * photo lived inside those records, each app open would download every
 * photo again. Instead a record holds a small reference ("media:abc123")
 * and the data itself sits in spaces/{space}/media/{id}. It's fetched
 * only when it scrolls into view, then cached, so it's never downloaded
 * twice. This keeps the app quick and well inside the free plan.
 *
 * Safety: anything shown as an image or played as audio must be a real
 * base64 image/audio data URL. Everything else is ignored, so a bad
 * value in the database can never become a link or script.
 *
 * In demo mode (no Firebase) records keep the data URL inline as before,
 * and old inline records keep working everywhere.
 */

const Media = (() => {
  const SAFE = /^data:(image\/(jpeg|png|webp|gif)|audio\/(mp4|aac|webm|ogg|mpeg|x-m4a|wav))(;codecs=[A-Za-z0-9.]+)?;base64,[A-Za-z0-9+/]+=*$/;
  const REF = /^media:[A-Za-z0-9_-]{1,64}$/;
  const MAX = 1400000;

  const cache = new Map(); // id -> data URL
  const pending = new Map(); // id -> Promise

  function safe(value) {
    return typeof value === "string" && value.length <= MAX && SAFE.test(value) ? value : "";
  }
  function isRef(value) {
    return typeof value === "string" && REF.test(value);
  }
  const idOf = (ref) => ref.slice(6);

  /**
   * Prepare a data URL for saving on a record. Returns a reference in
   * shared mode (and uploads it), or the data URL itself in demo mode.
   */
  function store(dataUrl) {
    const data = safe(dataUrl);
    if (!data) throw new Error("That file couldn't be used. Try another one.");
    if (!Cloud.isActive()) return data;
    const id = UI.uid("md");
    cache.set(id, data);
    Cloud.putMedia(id, data);
    return `media:${id}`;
  }

  /** The data URL if it's available right now, else "". */
  function peek(value) {
    if (isRef(value)) return cache.get(idOf(value)) || "";
    return safe(value);
  }

  /** Resolve a reference or data URL to a safe data URL ("" if unusable). */
  function load(value) {
    if (!value) return Promise.resolve("");
    if (!isRef(value)) return Promise.resolve(safe(value));
    const id = idOf(value);
    if (cache.has(id)) return Promise.resolve(cache.get(id));
    if (pending.has(id)) return pending.get(id);
    const p = Cloud.getMedia(id)
      .then((data) => {
        const ok = safe(data);
        if (ok) cache.set(id, ok);
        return ok;
      })
      .catch(() => "")
      .finally(() => pending.delete(id));
    pending.set(id, p);
    return p;
  }

  function remove(value) {
    if (!isRef(value)) return;
    cache.delete(idOf(value));
    Cloud.deleteMedia(idOf(value));
  }

  /** Attributes that mark an element to be filled lazily. */
  function attrs(value, as = "bg") {
    return `data-media="${UI.escape(value || "")}" data-media-as="${as}"`;
  }

  function apply(el, url) {
    const as = el.getAttribute("data-media-as") || "bg";
    if (!url) {
      el.classList.add("media--missing");
      return;
    }
    if (as === "src") {
      if (el.getAttribute("src") !== url) el.src = url;
    } else if (as === "bg") {
      el.style.backgroundImage = `url("${url}")`;
    }
    el.classList.add("media--ready");
  }

  const observer =
    "IntersectionObserver" in window
      ? new IntersectionObserver(
          (entries) =>
            entries.forEach((e) => {
              if (!e.isIntersecting) return;
              observer.unobserve(e.target);
              load(e.target.getAttribute("data-media")).then((url) => apply(e.target, url));
            }),
          { rootMargin: "600px 0px" }
        )
      : null;

  /** Fill every marked element inside `root`, lazily where possible. */
  function hydrate(root) {
    if (!root) return;
    root.querySelectorAll("[data-media]:not([data-media-bound])").forEach((el) => {
      el.setAttribute("data-media-bound", "");
      const value = el.getAttribute("data-media");
      const now = peek(value);
      if (now) apply(el, now);
      else if (observer) observer.observe(el);
      else load(value).then((url) => apply(el, url));
    });
  }

  /**
   * One-off tidy-up for shared mode: move photos and voice notes that
   * were saved inside records (before the media store existed) into it.
   * Each phone only moves what its own person created, so the two never
   * duplicate the work. Items without an owner are moved by the first
   * person in config.js.
   */
  function migrate() {
    if (!Cloud.isActive()) return;
    const me = Auth.currentUser();
    if (!me) return;
    const first = Object.keys(CONFIG.users)[0];
    const mine = (owner) => (owner ? owner === me.id : me.id === first);
    const move = (item, fields) => {
      let next = item;
      fields.forEach((f) => {
        const v = item[f];
        if (typeof v === "string" && v.startsWith("data:") && safe(v)) {
          try {
            next = { ...next, [f]: store(v) };
          } catch {}
        }
      });
      return next;
    };
    const run = (get, set, owner, fields) => {
      let changed = false;
      const list = get().map((item) => {
        if (!mine(owner(item))) return item;
        const next = move(item, fields);
        if (next !== item) changed = true;
        return next;
      });
      if (changed) set(list);
    };
    run(() => Storage.getMemories() || [], (l) => Storage.setMemories(l), (m) => m.addedBy, ["image"]);
    run(() => Storage.getCapsules(), (l) => Storage.setCapsules(l), (c) => c.from, ["photo"]);
    run(() => Storage.getMessages() || [], (l) => Storage.setMessages(l), (m) => m.from, ["image", "audio"]);
    const shared = Storage.getWallpaperShared();
    if (shared && shared.by === me.id && typeof shared.photo === "string" && shared.photo.startsWith("data:")) {
      const next = move(shared, ["photo"]);
      if (next !== shared) Storage.setWallpaperShared(next);
    }
  }

  return { safe, isRef, store, peek, load, remove, attrs, hydrate, migrate };
})();
