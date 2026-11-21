// Service worker: makes the game work with no network at all.
//
// The shell (html, js) uses network-first so a new version is picked up as soon
// as it is online; the audio samples use cache-first, because they never change
// and they are the only heavy part of the download.

const VERSION = 'emi-world-v1';
const SHELL = `${VERSION}-shell`;
const MEDIA = `${VERSION}-media`;

const SHELL_FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/icon.svg',
  './assets/fonts/varela-round-hebrew.woff2',
  './assets/fonts/varela-round-latin.woff2',
  './assets/fonts/secular-one-hebrew.woff2',
  './assets/fonts/secular-one-latin.woff2',
  './src/main.js',
  './src/core/engine.js',
  './src/core/audio.js',
  './src/core/util.js',
  './src/core/fx.js',
  './src/core/gfx.js',
  './src/core/palette.js',
  './src/core/creatures.js',
  './src/core/state.js',
  './src/core/ui.js',
  './src/scenes/title.js',
  './src/scenes/hub.js',
  './src/scenes/balloons.js',
  './src/scenes/animals.js',
  './src/scenes/music.js',
  './src/scenes/shapes.js',
  './src/scenes/paint.js',
  './src/scenes/ocean.js',
  // Emi's Magic Island, the second game
  './adventure.html',
  './adventure.webmanifest',
  './assets/island-192.png',
  './src/adventure/main.js',
  './src/adventure/speech.js',
  './src/adventure/art.js',
  './src/adventure/scenery.js',
  './src/adventure/scenes/title.js',
  './src/adventure/scenes/island.js',
  './src/adventure/scenes/cake.js',
  './src/adventure/scenes/puzzle.js',
  './src/adventure/scenes/memory.js',
  './src/adventure/scenes/feed.js',
  './src/adventure/scenes/coloring.js',
  './src/adventure/scenes/garden.js',
  './src/adventure/scenes/colorpop.js',
  './src/adventure/magic.js',
  './src/adventure/base.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SHELL)
      // A single missing file must not fail the whole install.
      .then((c) => Promise.allSettled(SHELL_FILES.map((f) => c.add(f))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== SHELL && k !== MEDIA).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;   // fonts etc. handled by the browser

  const isMedia = /\.(mp3|ogg|wav|png|svg|jpg|woff2)$/.test(url.pathname);

  if (isMedia) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(MEDIA).then((c) => c.put(req, copy));
        }
        return res;
      }))
    );
    return;
  }

  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit
        || caches.match(url.pathname.endsWith('adventure.html') ? './adventure.html' : './index.html')))
  );
});
