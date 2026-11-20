/**
 * sw.js — makes Our Space open fast and work without signal.
 *
 * - App files (HTML/CSS/JS/icons): network first, so you always get the
 *   latest version when online, falling back to the saved copy offline.
 * - Fonts and the Firebase SDK (versioned, never change): cache first.
 * - Firebase data itself is not touched here; Firestore keeps its own
 *   offline copy.
 */
const VERSION = "ourspace-v16";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/style.css",
  "./css/responsive.css",
  "./js/config.js",
  "./js/storage.js",
  "./js/ui.js",
  "./js/media.js",
  "./js/cloud.js",
  "./js/auth.js",
  "./js/avatars.js",
  "./js/router.js",
  "./js/lock.js",
  "./js/countdown.js",
  "./js/wallpaper.js",
  "./js/voice.js",
  "./js/camera.js",
  "./js/heartbeat.js",
  "./js/calls.js",
  "./js/chat.js",
  "./js/notes.js",
  "./js/memories.js",
  "./js/journey.js",
  "./js/together.js",
  "./js/us.js",
  "./js/activity.js",
  "./js/tilt.js",
  "./js/app.js",
  "./assets/icons/favicon.svg",
  "./assets/icons/seal.svg",
  "./assets/icons/apple-touch-icon.png",
  "./assets/icons/icon-192.png",
];
const IMMUTABLE_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com", "www.gstatic.com"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function networkFirst(request) {
  return fetch(request)
    .then((response) => {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(VERSION).then((cache) => cache.put(request, copy));
      }
      return response;
    })
    .catch(() =>
      caches.match(request, { ignoreSearch: true }).then((hit) => hit || caches.match("./index.html"))
    );
}

function cacheFirst(request) {
  return caches.match(request).then(
    (hit) =>
      hit ||
      fetch(request).then((response) => {
        if (response && (response.ok || response.type === "opaque")) {
          const copy = response.clone();
          caches.open(VERSION).then((cache) => cache.put(request, copy));
        }
        return response;
      })
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(request));
    return;
  }
  // Only the font and SDK files; never Firestore or Auth traffic.
  if (IMMUTABLE_HOSTS.includes(url.hostname) && (url.hostname !== "www.gstatic.com" || url.pathname.startsWith("/firebasejs/"))) {
    event.respondWith(cacheFirst(request));
  }
});

// ------------------------------------------------------------------
// Notifications. The Cloudflare notifier sends a small private payload
// ({ title, body, url, tag }); we show it with the wax-seal icon and
// open the right page when it's tapped.
// ------------------------------------------------------------------
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }
  const d = payload.data || payload.notification || payload;
  const scope = self.registration.scope;
  const url = typeof d.url === "string" && d.url.startsWith(scope) ? d.url : scope + "#/chat";
  event.waitUntil(
    self.registration.showNotification(d.title || "Our Space", {
      body: d.body || "Something new is waiting for you",
      icon: "assets/icons/icon-192.png",
      badge: "assets/icons/icon-192.png",
      tag: d.tag || "ourspace",
      renotify: true,
      data: { url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || self.registration.scope;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const open = clients.find((c) => c.url.startsWith(self.registration.scope));
      if (open) {
        open.focus();
        return open.navigate ? open.navigate(url).catch(() => open.postMessage({ type: "open", url })) : open.postMessage({ type: "open", url });
      }
      return self.clients.openWindow(url);
    })
  );
});
