/**
 * storage.js
 * The only file in the app allowed to talk to localStorage directly.
 *
 * Every other module (chat.js, notes.js, memories.js, journey.js)
 * calls the functions below instead of touching window.localStorage.
 * When Version 2 moves to Firestore, only this file needs to change —
 * swap each function body for a Firestore call and keep the same
 * signatures. Callers won't know the difference.
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

  return {
    // Generic read/write, used by feature modules below.
    get: safeGet,
    set: safeSet,

    // --- Session (demo auth) -------------------------------------
    getSession() {
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

    // --- Messages ---------------------------------------------------
    getMessages() {
      return safeGet(CONFIG.storageKeys.messages, null);
    },
    setMessages(messages) {
      return safeSet(CONFIG.storageKeys.messages, messages);
    },

    // --- Notes --------------------------------------------------------
    getNotes() {
      return safeGet(CONFIG.storageKeys.notes, null);
    },
    setNotes(notes) {
      return safeSet(CONFIG.storageKeys.notes, notes);
    },

    // --- Memories -----------------------------------------------------
    getMemories() {
      return safeGet(CONFIG.storageKeys.memories, null);
    },
    setMemories(memories) {
      return safeSet(CONFIG.storageKeys.memories, memories);
    },

    // --- Journey --------------------------------------------------------
    getJourney() {
      return safeGet(CONFIG.storageKeys.journey, null);
    },
    setJourney(events) {
      return safeSet(CONFIG.storageKeys.journey, events);
    },

    // --- Theme ------------------------------------------------------
    getTheme() {
      return safeGet(CONFIG.theme.storageKey, CONFIG.theme.default);
    },
    setTheme(theme) {
      return safeSet(CONFIG.theme.storageKey, theme);
    },
  };
})();
