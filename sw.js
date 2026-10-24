// Offline support. Network first (so updates appear right away), cache as fallback.
// Bump VERSION when you upload a new release.
const VERSION = 'fc-1.1.1';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './js/main.js', './js/config.js',
  './js/core/dates.js', './js/core/recurrence.js', './js/core/store.js', './js/core/actions.js',
  './js/services/wmo.js', './js/services/weather.js', './js/services/clothing.js', './js/services/speech.js',
  './js/services/parser-rules.js', './js/services/parser-gemini.js', './js/services/commands.js', './js/services/backup.js',
  './js/ui/dom.js', './js/ui/icons.js', './js/ui/sheet.js', './js/ui/chrome.js', './js/ui/weather-widget.js',
  './js/ui/views/time-grid.js', './js/ui/views/month.js',
  './js/ui/sheets/event-editor.js', './js/ui/sheets/members.js', './js/ui/sheets/settings.js', './js/ui/sheets/voice.js',
  './icons/apple-touch-icon.png', './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return; // weather, Gemini: network only
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true })),
  );
});
