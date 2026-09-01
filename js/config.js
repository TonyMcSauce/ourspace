/**
 * config.js
 * Single source of truth for anything that might change later.
 * Nothing else in the app should hard-code names, dates, or copy —
 * everything reads from here so Version 2 (Firebase) can swap
 * values without touching component logic.
 */

const CONFIG = {
  appName: "OUR SPACE",
  appNameShort: "Our Space",
  tagline: "Just us.",

  // Demo identities. Replace with real auth profiles when Firebase
  // Authentication is wired in (see auth.js).
  users: {
    tony: {
      id: "tony",
      displayName: "Tony",
      avatarInitial: "T",
      statusText: "probably thinking about you",
    },
    babegirl: {
      id: "babegirl",
      displayName: "Babegirl",
      avatarInitial: "B",
      statusText: "online",
    },
  },

  // ISO date the relationship started. Drives the "Our Journey"
  // counter — change this one line and every dependent view updates.
  relationshipStartDate: "2024-02-14T00:00:00",

  favouriteThings: {
    food: "Late-night ramen runs",
    place: "That bench by the harbour",
    movie: "Spirited Away",
    song: "Coming soon",
    insideJoke: "\u201Cthe incident\u201D (you know the one)",
  },

  theme: {
    default: "light", // "light" | "dark"
    storageKey: "ourspace_theme",
  },

  storageKeys: {
    session: "ourspace_session",
    messages: "ourspace_messages",
    notes: "ourspace_notes",
    memories: "ourspace_memories",
    journey: "ourspace_journey",
  },
};

// Freeze one level deep so accidental mutation elsewhere fails loudly
// during development rather than silently drifting from source.
Object.keys(CONFIG).forEach((key) => {
  if (typeof CONFIG[key] === "object" && CONFIG[key] !== null) {
    Object.freeze(CONFIG[key]);
  }
});
Object.freeze(CONFIG);
