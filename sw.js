'use strict';
/* Asia 2027 — offline app shell. Network-first with cache fallback so code stays fresh. */
const CACHE = 'asia-2027-v5';
const ASSETS = ['./', './index.html', './app.js', './leaflet.js', './leaflet.css', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => Promise.all(ASSETS.map(a => c.add(new Request(a, { cache: 'reload' })).catch(() => null))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('asia-2027') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return; // map tiles go straight to network
  const fresh = fetch(e.request).then(res => {
    if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return res;
  }).catch(() => null);
  e.respondWith(
    fresh.then(res => res || caches.match(e.request).then(h => h || caches.match('./index.html')))
  );
});
