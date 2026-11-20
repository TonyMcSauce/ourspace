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
      // SHA-256 of this person's Firebase login email (lowercase).
      // Only a fingerprint is kept here so the email itself never
      // appears in the public code. See README for how to make one.
      emailHash: "98af3f082bec9181dd2fdd85691b90027b256f001d3605cd8e8890365aaa8115",
      statusText: "probably thinking about you",
    },
    babegirl: {
      id: "babegirl",
      displayName: "Babegirl",
      avatarInitial: "B",
      emailHash: "d9c4ab0c8b94caf18de9b56598ce7b7cf043acf0e55a1246d69f01e519066065",
      statusText: "online",
    },
  },

  // Firebase: paste the web app config from the Firebase console here
  // (Project settings > General > Your apps). These values are public
  // identifiers, not secrets; access is protected by firestore.rules.
  // Leave apiKey empty to run in local demo mode on a single device.
  firebase: {
    apiKey: "AIzaSyAuCbX9J_qqChgAoam6-g62_QI43jB_rLo",
    authDomain: "ourspace-8a901.firebaseapp.com",
    projectId: "ourspace-8a901",
    storageBucket: "ourspace-8a901.firebasestorage.app",
    messagingSenderId: "620872244756",
    appId: "1:620872244756:web:3b77f08fa84db5b4ed1101",
  },

  // Name of your shared space in the database. No need to change it.
  spaceId: "us",

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
    jar: "ourspace_jar",
    capsules: "ourspace_capsules",
    lists: "ourspace_lists",
    listItems: "ourspace_list_items",
    notes: "ourspace_notes",
    memories: "ourspace_memories",
    journey: "ourspace_journey",
    favourites: "ourspace_favourites",
    song: "ourspace_song",
    countdown: "ourspace_countdown",
    profile: "ourspace_profile",
    startDateCache: "ourspace_start_date",
    wallpaper: "ourspace_wallpaper",
    avatars: "ourspace_avatars",
    avatarsCache: "ourspace_avatars_cache",
    wallpaperShared: "ourspace_wallpaper_shared",
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
