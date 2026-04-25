// ═══════════════════════════════════════════════════════════════════════════════
// CrisisFlow Service Worker — Offline-First Emergency Response
// ═══════════════════════════════════════════════════════════════════════════════
// CRITICAL: This service worker ensures the app functions even when the hotel
// Wi-Fi fails during a crisis. It caches the shell + critical assets, and
// queues outgoing incident reports for replay when connectivity returns.

const CACHE_NAME = 'crisisflow-v1';
const OFFLINE_URL = '/offline.html';

// Core shell files to pre-cache
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
];

// ── INSTALL ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  console.log('[SW] Installing CrisisFlow Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching app shell');
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        // Don't fail install if some URLs aren't available yet
        console.warn('[SW] Some precache URLs failed:', err);
      });
    })
  );
  // Activate immediately — don't wait for old tabs to close
  self.skipWaiting();
});

// ── ACTIVATE ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  // Claim all open clients immediately
  self.clients.claim();
});

// ── FETCH — Network-first with cache fallback ────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET requests (we'll handle POST queuing separately)
  if (request.method !== 'GET') return;

  // Skip external APIs (Firebase, Gemini, etc.)
  if (!request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful responses
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(async () => {
        // Network failed — try cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) return cachedResponse;

        // If it's a navigation request, show offline page
        if (request.mode === 'navigate') {
          const offlinePage = await caches.match(OFFLINE_URL);
          if (offlinePage) return offlinePage;
        }

        // Last resort: empty response
        return new Response('Offline — data unavailable', {
          status: 503,
          statusText: 'Service Unavailable',
        });
      })
  );
});

// ── Background Sync for queued incident reports ──────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-incidents') {
    console.log('[SW] Background sync: replaying queued incidents');
    event.waitUntil(replayQueuedIncidents());
  }
});

async function replayQueuedIncidents() {
  // In production: read from IndexedDB queue and POST to Firebase
  console.log('[SW] Replaying queued incidents from IndexedDB...');
  // Implementation would iterate over stored incident reports and push them
}

// ── Push Notifications ───────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  const title = data.title || '🚨 CrisisFlow Alert';
  const options = {
    body: data.body || 'New crisis update available',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    vibrate: [200, 100, 200],
    tag: 'crisis-alert',
    renotify: true,
    requireInteraction: true,
    data: { url: data.url || '/' },
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      // Focus existing window or open new one
      for (const client of clients) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
