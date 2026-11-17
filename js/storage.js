/**
 * storage.js
 * The single persistence layer. Feature modules (chat, notes, memories,
 * journey, us) only ever call the functions below.
 *
 * Two backends, same API:
 *   - Local (demo): everything lives in this browser's localStorage.
 *   - Cloud (Firebase): cloud.js plugs in a remote adapter. Reads come
 *     from an in-memory copy kept live by Firestore listeners, so the
 *     getters stay synchronous; writes update that copy immediately and
 *     sync to Firestore in the background.
 *
 * The theme preference always stays local: it's per device, not shared.
 */

const Storage = (() => {
  function safeGet(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      console.warn(`Storage: couldn't read "${key}", using fallback.`, err);
      return fallback;
    }
  }

  function safeSet(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      console.warn(`Storage: couldn't write "${key}".`, err);
      return false;
    }
  }

  // ---------------------------------------------------------------
  // Remote (cloud) plumbing
  // ---------------------------------------------------------------
  let remote = null;
  const cache = {};
  const listeners = new Set();

  // Keep shared lists in one stable order so a write and its echo from
  // the server compare equal and don't cause needless re-renders.
  const ORDER = {
    messages: (a, b) => (a.ts || 0) - (b.ts || 0) || String(a.id).localeCompare(String(b.id)),
    notes: (a, b) => (b.date || 0) - (a.date || 0) || String(a.id).localeCompare(String(b.id)),
    memories: (a, b) => (b.addedAt || 0) - (a.addedAt || 0) || String(a.id).localeCompare(String(b.id)),
    journey: (a, b) => String(a.date).localeCompare(String(b.date)) || String(a.id).localeCompare(String(b.id)),
  };

  function normalise(kind, value) {
    return Array.isArray(value) && ORDER[kind] ? [...value].sort(ORDER[kind]) : value;
  }

  function same(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  function read(kind, key, fallback) {
    if (!remote) return safeGet(key, fallback);
    return kind in cache ? cache[kind] : fallback;
  }

  function write(kind, key, value) {
    if (!remote) return safeSet(key, value);
    const prev = cache[kind];
    const next = normalise(kind, value);
    cache[kind] = next;
    remote.write(kind, next, prev);
    return true;
  }

  function emit(kind) {
    listeners.forEach((fn) => {
      try {
        fn(kind);
      } catch (err) {
        console.error(err);
      }
    });
  }

  return {
    // --- Backend switching (used by cloud.js) -----------------------
    useRemote(adapter) {
      remote = adapter;
    },
    isRemote() {
      return !!remote;
    },
    /** Called by cloud.js whenever Firestore reports new data. */
    receive(kind, value) {
      const next = normalise(kind, value);
      const changed = !(kind in cache) || !same(cache[kind], next);
      cache[kind] = next;
      if (changed) emit(kind);
    },
    clearCache() {
      Object.keys(cache).forEach((k) => delete cache[k]);
    },
    /** Subscribe to data changes. Returns an unsubscribe function. */
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    // --- Session ------------------------------------------------------
    getSession() {
      if (remote) return remote.session();
      return safeGet(CONFIG.storageKeys.session, null);
    },
    setSession(userId) {
      return safeSet(CONFIG.storageKeys.session, { userId, loggedInAt: Date.now() });
    },
    clearSession() {
      try {
        window.localStorage.removeItem(CONFIG.storageKeys.session);
        return true;
      } catch (err) {
        console.warn("Storage: couldn't clear session.", err);
        return false;
      }
    },

    // --- Shared data ------------------------------------------------
    // In cloud mode lists default to [] (never null) so the demo seed
    // data is never written into your real, shared space.
    getMessages() {
      return read("messages", CONFIG.storageKeys.messages, remote ? [] : null);
    },
    setMessages(messages) {
      return write("messages", CONFIG.storageKeys.messages, messages);
    },

    getNotes() {
      return read("notes", CONFIG.storageKeys.notes, remote ? [] : null);
    },
    setNotes(notes) {
      return write("notes", CONFIG.storageKeys.notes, notes);
    },

    getMemories() {
      return read("memories", CONFIG.storageKeys.memories, remote ? [] : null);
    },
    setMemories(memories) {
      return write("memories", CONFIG.storageKeys.memories, memories);
    },

    getJourney() {
      return read("journey", CONFIG.storageKeys.journey, remote ? [] : null);
    },
    setJourney(events) {
      return write("journey", CONFIG.storageKeys.journey, events);
    },

    getFavourites() {
      return read("favourites", CONFIG.storageKeys.favourites, null);
    },
    setFavourites(favourites) {
      return write("favourites", CONFIG.storageKeys.favourites, favourites);
    },

    getSong() {
      return read("song", CONFIG.storageKeys.song, null);
    },
    setSong(song) {
      return write("song", CONFIG.storageKeys.song, song);
    },

    getCountdown() {
      return read("countdown", CONFIG.storageKeys.countdown, null);
    },
    setCountdown(countdown) {
      return write("countdown", CONFIG.storageKeys.countdown, countdown);
    },

    /** { [userId]: lastSeenMs } — only populated in cloud mode. */
    getPresence() {
      return remote ? cache.presence || {} : {};
    },

    // --- Theme (always per device) -----------------------------------
    getTheme() {
      return safeGet(CONFIG.theme.storageKey, CONFIG.theme.default);
    },
    setTheme(theme) {
      return safeSet(CONFIG.theme.storageKey, theme);
    },
  };
})();
