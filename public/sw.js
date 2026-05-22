const CACHE_NAME = 'tasbih-cache-v1';
const ASSETS_TO_CACHE = [
  './',
  'index.html',
  'manifest.json',
  'icon.svg'
];

// Install Event - Pre-cache minimal shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate Event - Clean up stale cache spaces on version bumps
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Stale-While-Revalidate caching pattern
self.addEventListener('fetch', (event) => {
  // Only proxy GET request queries belonging to app origin or trusted public web fonts
  const requestUrl = new URL(event.request.url);
  const isLocalStorageOrExtension = !event.request.url.startsWith('http');
  const isPost = event.request.method !== 'GET';

  if (isLocalStorageOrExtension || isPost) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Always trigger fresh background network fetch to cache newer assets
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          // Verify response is completely valid before updating cache space
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            (networkResponse.type === 'basic' || requestUrl.host.includes('fonts.googleapis.com') || requestUrl.host.includes('fonts.gstatic.com'))
          ) {
            const cacheCopy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, cacheCopy);
            });
          }
          return networkResponse;
        })
        .catch((err) => {
          // Silently fail network logging
          return cachedResponse;
        });

      // Serve immediately from cache if we have it, else wait for network fetch
      return cachedResponse || fetchPromise;
    })
  );
});


// Message Event - allow page to request immediate activation on update
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
