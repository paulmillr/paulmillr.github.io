const cacheName = 'assets_v1'

const precachedAssets = [
  '/demos/nostr/',
  '/assets/stylesheets/style.css',
  '/assets/images/profile.jpg',
  '/demos/nostr/dist/main.css',
  '/demos/nostr/dist/main.js'
]

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then((cache) => {
    return cache.addAll(precachedAssets);
  }));
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const isPrecachedRequest = precachedAssets.includes(url.pathname);
  if (isPrecachedRequest) {
    // Open the cache
    event.respondWith(caches.open(cacheName).then((cache) => {
      // Go to the network first
      return fetch(event.request.url).then((fetchedResponse) => {
        cache.put(url.pathname, fetchedResponse.clone());
  
        return fetchedResponse;
      }).catch(() => {
        // If the network is unavailable, get
        return cache.match(url.pathname);
      });
    }));
  }
});

// Take control of any open clients after serviceworker was updated
self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim())
})