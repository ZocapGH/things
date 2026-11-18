/* Service Worker: macht Things offline-fÃ¤hig. Netz zuerst (immer aktuell), Cache als RÃ¼ckfall.
   Bei neuen Dateien: Liste ergÃ¤nzen und CACHE-Version erhÃ¶hen. */
const CACHE = 'things-v7';
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/core.js', 'js/app.js',
  'js/things/pendulum.js', 'js/things/opart.js', 'js/things/fractal.js', 'js/things/fourier.js',
  'js/things/gravity.js', 'js/things/cloth.js', 'js/things/harmonograph.js', 'js/things/attractor.js',
  'js/things/kaleido.js', 'js/things/flowfield.js', 'js/things/chladni.js', 'js/things/optics.js',
  'js/things/efield.js', 'js/things/fluid.js', 'js/things/water.js', 'js/things/maze.js', 'js/things/ripple.js', 'js/things/reaction.js', 'js/things/galton.js',
  'js/things/boids.js', 'js/things/sand.js', 'js/things/sorting.js', 'js/things/life.js', 'js/things/langton.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('index.html')))
  );
});
