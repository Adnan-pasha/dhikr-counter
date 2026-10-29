// BUILD_MANIFEST is replaced at build time by the `sw-build-manifest` Vite plugin
// (vite.config.ts) with the content-hashed id and the emitted asset list. In dev the
// placeholder stays, and the page does not register this worker at all.
const BUILD_MANIFEST = /*__BUILD_MANIFEST__*/ { id: 'dev', assets: [] };

const SHELL_CACHE = `tasbih-shell-${BUILD_MANIFEST.id}`;
// Quran data is versioned independently so app releases don't evict offline surahs.
// v2: the reader now asks for different editions (public-domain translation), so v1 entries are stale
// and the old copyrighted translation is not kept on devices.
const QURAN_CACHE = 'tasbih-quran-v2';
const KNOWN_CACHES = [SHELL_CACHE, QURAN_CACHE];
const CACHE_PREFIX = 'tasbih-';
const QURAN_API_HOST = 'api.alquran.cloud';
const QURAN_NETWORK_TIMEOUT_MS = 4500;

const SHELL_ASSETS = [
  './',
  'index.html',
  'manifest.json',
  'icon.svg',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-512.png',
  // Bundled adhan: precached so prayer-time playback works offline.
  'audio/adhan.m4a',
  ...BUILD_MANIFEST.assets,
];

// Install: pre-cache the shell AND every hashed build asset, so the first offline visit
// works. Activation waits for the page to send SKIP_WAITING so the in-app "Update"
// prompt stays meaningful.
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)));
});

// Activate: drop superseded caches owned by this app only (never other apps on the origin).
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && !KNOWN_CACHES.includes(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// Cache lookups ignore Vary. Hosts often send `Vary: Origin`, and browsers add an Origin
// header to same-origin module-script requests that precached entries never had, so a strict
// match misses and the first offline reload is blank.
const matchCache = (request) => caches.match(request, { ignoreVary: true });

// Only cache complete, same-purpose responses. HTML served for a non-document request is an
// SPA fallback for a missing file; caching it would poison that URL permanently.
const isCacheable = (request, response) => {
  if (!response || response.status !== 200) return false;
  if (response.type !== 'basic' && response.type !== 'cors') return false;
  if (response.redirected) return false;
  const contentType = (response.headers && response.headers.get('content-type')) || '';
  if (request.destination !== 'document' && contentType.includes('text/html')) return false;
  return true;
};

const putInCache = (cacheName, request, response) => {
  const copy = response.clone();
  return caches.open(cacheName).then((cache) => cache.put(request, copy));
};

const remember = (event, cacheName, request, response) => {
  if (isCacheable(request, response)) {
    event.waitUntil(putInCache(cacheName, request, response).catch(() => {}));
  }
  return response;
};

// Network first, falling back to cache. Used for navigations and the Quran API.
const networkFirst = (event, request, cacheName, { fallbackUrl, timeoutMs } = {}) => {
  const network = fetch(request).then((response) => remember(event, cacheName, request, response));
  network.catch(() => {}); // a late rejection after a timeout must not surface as unhandled
  const guarded = timeoutMs
    ? Promise.race([network, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs))])
    : network;
  return guarded.catch(() =>
    matchCache(request)
      .then((cached) => cached || (fallbackUrl ? matchCache(fallbackUrl) : undefined))
      .then((cached) => cached || network.catch(() => Response.error())),
  );
};

// Hashed build assets never change for a given URL, so cache-first is safe.
const cacheFirst = (event, request) =>
  matchCache(request).then(
    (cached) => cached || fetch(request).then((response) => remember(event, SHELL_CACHE, request, response)),
  );

const staleWhileRevalidate = (event, request) =>
  matchCache(request).then((cached) => {
    const refresh = fetch(request)
      .then((response) => remember(event, SHELL_CACHE, request, response))
      .catch(() => cached || Response.error());
    return cached || refresh;
  });

// Media elements (notably Safari) request byte ranges and reject a plain 200 for them, so
// ranges for cached files are answered from the cached body.
const rangeResponse = (request, cached) =>
  cached.arrayBuffer().then((buffer) => {
    const match = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range') || '');
    if (!match || (match[1] === '' && match[2] === '')) {
      return new Response(buffer, { status: 200, headers: cached.headers });
    }
    const size = buffer.byteLength;
    let start;
    let end;
    if (match[1] === '') {
      start = Math.max(size - Number(match[2]), 0);
      end = size - 1;
    } else {
      start = Number(match[1]);
      end = match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1);
    }
    if (start >= size || start > end) {
      return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
    }
    const headers = new Headers(cached.headers);
    headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
    headers.set('Content-Length', String(end - start + 1));
    headers.set('Accept-Ranges', 'bytes');
    return new Response(buffer.slice(start, end + 1), { status: 206, headers });
  });

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || !request.url.startsWith('http')) return;

  const url = new URL(request.url);

  if (url.origin === self.location.origin && request.headers && request.headers.get('range')) {
    event.respondWith(
      matchCache(request).then((cached) => (cached ? rangeResponse(request, cached) : fetch(request))),
    );
    return;
  }

  if (url.host === QURAN_API_HOST) {
    event.respondWith(networkFirst(event, request, QURAN_CACHE, { timeoutMs: QURAN_NETWORK_TIMEOUT_MS }));
    return;
  }

  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(event, request, SHELL_CACHE, { fallbackUrl: 'index.html' }));
    return;
  }

  if (url.pathname.includes('/assets/')) {
    event.respondWith(cacheFirst(event, request));
    return;
  }

  event.respondWith(staleWhileRevalidate(event, request));
});

// Page asks to activate a waiting worker after the user accepts the update prompt.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// A tap on a reminder notification brings the app forward and starts that dhikr.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const dhikrId = event.notification.data && event.notification.data.dhikrId;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = windows[0];
    if (open) {
      try { await open.focus(); } catch (e) { /* still tell the page which dhikr was tapped */ }
      if (dhikrId) open.postMessage({ type: 'OPEN_DHIKR', dhikrId });
      return;
    }
    await self.clients.openWindow(dhikrId ? './?dhikr=' + encodeURIComponent(dhikrId) : './');
  })());
});
