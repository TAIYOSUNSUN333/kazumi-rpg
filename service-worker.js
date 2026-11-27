// Change the cache name whenever a published app shell changes.
const cachePrefix = 'kazumi-rpg-';
const cacheName = cachePrefix + 'action-11';
const shellFiles = [
  './', './index.html', './game.css', './manifest.webmanifest',
  './prefectures.js', './world.js', './riddles.js', './stones.js', './bgm.js', './audio.js',
  './companions.js', './towns.js', './tourism.js', './graphics.js', './battlefield.js',
  './bath.js', './inn.js', './terrain.js', './stages.js', './movement.js', './command-battle.js',
  './action-battle.js', './encounter-group.js', './summons.js', './market.js', './game.js', './action-render.js', './lodging-render.js', './render.js',
  './assets/portrait-0.webp', './assets/story-0.webp', './assets/land-0.webp',
  './assets/actors.webp', './assets/soso.webp', './assets/action-poses.webp',
  './assets/enemy-0.webp', './assets/enemy-1.webp', './assets/enemy-2.webp',
  './assets/enemy-3.webp', './assets/arena-market.webp', './assets/arena-forest.webp'
];
const scope = self.registration.scope;
const shellURLs = new Set(shellFiles.map(path => new URL(path,scope).href));

self.addEventListener('install',event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(shellFiles)).then(() => self.skipWaiting()));
});

self.addEventListener('activate',event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(cachePrefix) && name !== cacheName).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch',event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || !url.href.startsWith(scope) || url.pathname.endsWith('/service-worker.js')) return;
  // Admin screens and authenticated APIs always use the browser's network path.
  if (['bgm-admin','bgm-studio','.netlify/functions/bgm-admin','assets/bgm/']
    .some(path => url.href.startsWith(scope+path))) return;
  const isShell = shellURLs.has(url.href);
  const isRoot = event.request.mode === 'navigate' && (url.pathname === new URL(scope).pathname ||
    shellURLs.has(url.origin + url.pathname));
  const isArtwork = url.href.startsWith(scope + 'assets/');
  if (!isShell && !isRoot && !isArtwork) return;

  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    const key = isRoot ? new URL('./',scope).href : event.request;
    const saved = await cache.match(key);
    if (saved) return saved;
    const response = await fetch(event.request);
    if (response.ok && isArtwork) {
      try { await cache.put(event.request,response.clone()); } catch {}
    }
    return response;
  })());
});
