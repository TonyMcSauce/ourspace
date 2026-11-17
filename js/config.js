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
    insideJoke: "\u201Cthe incident\u201D (you know the one)",
  },

  // Starting point for "Our Song". Editable in the app (Us page);
  // edits are saved through storage.js and override this.
  song: {
    title: "",
    artist: "",
    link: "",
  },

  theme: {
    // "light" | "dark" | "system" (follows the device setting until
    // someone flips the toggle on the Us page).
    default: "system",
    storageKey: "ourspace_theme",
  },

  storageKeys: {
    session: "ourspace_session",
    messages: "ourspace_messages",
    notes: "ourspace_notes",
    memories: "ourspace_memories",
    journey: "ourspace_journey",
    favourites: "ourspace_favourites",
    song: "ourspace_song",
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
