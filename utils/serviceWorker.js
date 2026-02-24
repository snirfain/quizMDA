/**
 * Service Worker Registration
 * Cache strategy for offline support
 * Hebrew: רישום Service Worker
 */

const CACHE_NAME = 'mda-quiz-v1';
const STATIC_CACHE_NAME = 'mda-static-v1';

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/main.jsx',
  '/App.jsx'
];

// API endpoints to cache (Cache First strategy)
const CACHE_FIRST_PATTERNS = [
  /\/api\/questions/,
  /\/api\/hierarchies/
];

// API endpoints (Network First strategy)
const NETWORK_FIRST_PATTERNS = [
  /\/api\/activity/,
  /\/api\/statistics/
];

/**
 * Register service worker
 * Disabled in development — the SW script must exist as a static file in /public.
 * To enable: copy SERVICE_WORKER_SCRIPT to public/serviceWorker.js and remove the early return.
 */
export function registerServiceWorker() {
  // Skip SW registration in development (Vite HMR conflicts with SW caching)
  if (import.meta.env.DEV) return;

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/serviceWorker.js')
        .then((registration) => {
          console.log('Service Worker registered:', registration.scope);
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('New service worker available');
              }
            });
          });
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error);
        });
    });
  }
}

/**
 * Unregister service worker (for development)
 */
export function unregisterServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then((registration) => {
      registration.unregister();
    });
  }
}

// Service Worker script content (to be written to public/serviceWorker.js)
export const SERVICE_WORKER_SCRIPT = `
// Service Worker for MDA Quiz App
const CACHE_NAME = '${CACHE_NAME}';
const STATIC_CACHE_NAME = '${STATIC_CACHE_NAME}';

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      return cache.addAll(${JSON.stringify(STATIC_ASSETS)});
    })
  );
  self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== STATIC_CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other protocols
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Cache First strategy for questions and hierarchies
  if (${JSON.stringify(CACHE_FIRST_PATTERNS)}.some(pattern => pattern.test(url.pathname))) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) {
          return cached;
        }
        return fetch(event.request).then((response) => {
          if (response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // Network First strategy for activity and statistics
  if (${JSON.stringify(NETWORK_FIRST_PATTERNS)}.some(pattern => pattern.test(url.pathname))) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request);
        })
    );
    return;
  }

  // Default: Network First for other requests
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
`;
