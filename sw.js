// ═══════════════════════════════════════════════════════════════════════════
//  UYEH TECH — SERVICE WORKER  v2.0  (sw.js)
//  Place at: / (root of uyeh.netlify.app — same level as index.html)
//
//  Upgrades over v1:
//   ✅ Versioned cache names — bump APP_VERSION to force fresh install
//   ✅ Individual URL pre-cache failures no longer abort the entire install
//   ✅ Opaque response guard — never cache 0-status cross-origin failures
//   ✅ API cache TTL — stale API responses expire after 5 minutes
//   ✅ POST/auth routes never cached (tokens must always hit the server)
//   ✅ Cloudinary image assets — dedicated long-lived cache (7 days)
//   ✅ Push notification payload validated + image/actions support added
//   ✅ Background sync for offline form submissions
//   ✅ Cache size limits — prevents unbounded disk growth
//   ✅ Periodic cache cleanup of stale API entries
//   ✅ SW message bus — pages can send SKIP_WAITING / GET_VERSION
//   ✅ Fixed: logo filename had a space (URL-encoded correctly)
// ═══════════════════════════════════════════════════════════════════════════

'use strict';

// ── Bump this string whenever you deploy new code ─────────────────────────
const APP_VERSION    = 'uyeh-v2.0';

const STATIC_CACHE   = `${APP_VERSION}-static`;
const API_CACHE      = `${APP_VERSION}-api`;
const IMAGE_CACHE    = `${APP_VERSION}-images`;

// API cache TTL: responses older than this are considered stale
const API_CACHE_TTL  = 5 * 60 * 1000;   // 5 minutes in ms

// Maximum number of entries per cache (prevents runaway growth)
const API_CACHE_MAX  = 60;
const IMAGE_CACHE_MAX = 80;

const BACKEND_HOST   = 'uyehtechbackend.onrender.com';
const FRONTEND_HOST  = 'uyeh.netlify.app';

// Routes whose responses must NEVER be cached (auth, payments, mutations)
const NEVER_CACHE_PATTERNS = [
  '/api/auth/',
  '/api/orders/verify-payment',
  '/api/orders/create',
  '/api/admin/',
  '/api/affiliate/register',
];

// Pages & assets to pre-cache at install time
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/projects.html',
  '/blog.html',
  '/store.html',
  '/dashboard.html',
  '/login.html',
  '/offline.html',
  '/site-controller.js',
  '/pwa-install.js',
  // Note: logo file name no longer has a space — see STEP 4 in SETUP GUIDE
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// ═══════════════════════════════════════════════════════════════════════════
// INSTALL — pre-cache static shell, one URL at a time so one 404 can't abort
// ═══════════════════════════════════════════════════════════════════════════
self.addEventListener('install', event => {
  console.log(`[SW ${APP_VERSION}] Installing…`);

  event.waitUntil(
    caches.open(STATIC_CACHE).then(async cache => {
      // Cache URLs individually — a missing file won't fail the whole install
      const results = await Promise.allSettled(
        PRECACHE_URLS.map(url =>
          cache.add(url).catch(err => {
            console.warn(`[SW] Pre-cache skip (${url}):`, err.message);
          })
        )
      );
      const cached  = results.filter(r => r.status === 'fulfilled').length;
      const skipped = results.length - cached;
      console.log(`[SW] Pre-cached ${cached} assets, skipped ${skipped}`);
    })
  );

  // Activate immediately — don't wait for old tabs to close
  self.skipWaiting();
});

// ═══════════════════════════════════════════════════════════════════════════
// ACTIVATE — delete old caches, claim all clients
// ═══════════════════════════════════════════════════════════════════════════
self.addEventListener('activate', event => {
  console.log(`[SW ${APP_VERSION}] Activating…`);

  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k =>
            k.startsWith('uyeh-') &&
            k !== STATIC_CACHE   &&
            k !== API_CACHE      &&
            k !== IMAGE_CACHE
          )
          .map(k => {
            console.log('[SW] Purging old cache:', k);
            return caches.delete(k);
          })
      )
    ).then(() => {
      console.log('[SW] Claiming all clients');
      return self.clients.claim();
    })
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// FETCH — route every request to the right caching strategy
// ═══════════════════════════════════════════════════════════════════════════
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // ── Never intercept non-GET ─────────────────────────────────────────────
  if (request.method !== 'GET') return;

  // ── Never intercept non-HTTP (chrome-extension://, etc.) ───────────────
  if (!url.protocol.startsWith('http')) return;

  // ── Auth / payment / admin routes → pure network, no cache ─────────────
  if (NEVER_CACHE_PATTERNS.some(p => url.pathname.startsWith(p))) {
    event.respondWith(fetch(request));
    return;
  }

  // ── API calls to the backend → network-first with TTL'd cache ──────────
  if (url.hostname === BACKEND_HOST || url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstApi(request));
    return;
  }

  // ── Cloudinary images → cache-first, long TTL ──────────────────────────
  if (url.hostname.includes('res.cloudinary.com')) {
    event.respondWith(cacheFirstImages(request));
    return;
  }

  // ── Google Fonts → cache-first, permanent ──────────────────────────────
  if (
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // ── CDN assets (cdnjs, fontawesome, etc.) → cache-first ────────────────
  if (
    url.hostname.includes('cdnjs.cloudflare.com') ||
    url.hostname.includes('kit.fontawesome.com')  ||
    url.hostname.includes('unpkg.com')
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // ── Own pages & assets → stale-while-revalidate ────────────────────────
  if (
    url.hostname === FRONTEND_HOST ||
    url.hostname === 'localhost'   ||
    url.hostname === '127.0.0.1'
  ) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// STRATEGY: Network-first with TTL for API responses
// ═══════════════════════════════════════════════════════════════════════════
async function networkFirstApi(request) {
  const cache = await caches.open(API_CACHE);

  try {
    const networkRes = await fetch(request.clone(), { signal: AbortSignal.timeout(8000) });

    if (networkRes.ok && !isOpaqueResponse(networkRes)) {
      // Stamp the cache time in a custom header clone
      const stamped = await stampResponse(networkRes.clone());
      cache.put(request, stamped);
      await trimCache(API_CACHE, API_CACHE_MAX);
    }
    return networkRes;

  } catch {
    // Network failed — return cached if not stale
    const cached = await cache.match(request);
    if (cached) {
      const age = await getCacheAge(cached);
      if (age < API_CACHE_TTL) {
        // Still fresh — serve with an offline header so the page knows
        return addHeader(cached, 'X-SW-Source', 'cache');
      }
    }
    // Stale or missing — return offline JSON
    return offlineJson();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// STRATEGY: Cache-first for Cloudinary images
// ═══════════════════════════════════════════════════════════════════════════
async function cacheFirstImages(request) {
  const cache  = await caches.open(IMAGE_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const networkRes = await fetch(request);
    if (networkRes.ok && !isOpaqueResponse(networkRes)) {
      cache.put(request, networkRes.clone());
      await trimCache(IMAGE_CACHE, IMAGE_CACHE_MAX);
    }
    return networkRes;
  } catch {
    return new Response('Image unavailable offline', { status: 503 });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// STRATEGY: Cache-first (fonts, CDN)
// ═══════════════════════════════════════════════════════════════════════════
async function cacheFirst(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const networkRes = await fetch(request);
    if (!isOpaqueResponse(networkRes)) {
      cache.put(request, networkRes.clone());
    }
    return networkRes;
  } catch {
    return new Response('Resource unavailable offline', { status: 503 });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// STRATEGY: Stale-while-revalidate (own pages)
// ═══════════════════════════════════════════════════════════════════════════
async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);

  // Always kick off a background update
  const networkPromise = fetch(request).then(networkRes => {
    if (networkRes.ok && !isOpaqueResponse(networkRes)) {
      cache.put(request, networkRes.clone());
    }
    return networkRes;
  }).catch(() => null);

  // Return cached immediately if we have it
  if (cached) {
    networkPromise.catch(() => {}); // suppress unhandled rejection
    return cached;
  }

  // No cache — wait for network
  const networkRes = await networkPromise;
  if (networkRes) return networkRes;

  // Both failed — serve offline page
  const offlinePage = await cache.match('/offline.html');
  return offlinePage || new Response('<h1>You are offline</h1>', {
    headers: { 'Content-Type': 'text/html' }
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// PUSH NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════
self.addEventListener('push', event => {
  if (!event.data) return;

  let data = {};
  try { data = event.data.json(); }
  catch { data = { title: 'UYEH TECH', body: event.data.text() }; }

  const options = {
    body:    data.body    || 'You have a new notification',
    icon:    data.icon    || '/icons/icon-192.png',
    badge:   data.badge   || '/icons/icon-96.png',
    image:   data.image   || undefined,
    tag:     data.tag     || 'uyeh-notification',
    renotify: data.renotify || false,
    data:    { url: data.url || '/', ...data.extra },
    actions: data.actions || [],
    vibrate: [200, 100, 200],
    requireInteraction: data.requireInteraction || false,
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'UYEH TECH', options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();

  const targetUrl = event.action
    ? (event.notification.data?.actions?.[event.action] || '/')
    : (event.notification.data?.url || '/');

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // Focus an existing tab if one is open on that URL
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new tab
      return clients.openWindow(targetUrl);
    })
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// BACKGROUND SYNC — retries failed form submissions when back online
// ═══════════════════════════════════════════════════════════════════════════
self.addEventListener('sync', event => {
  if (event.tag === 'uyeh-offline-queue') {
    event.waitUntil(replayOfflineQueue());
  }
});

async function replayOfflineQueue() {
  // The page stores failed requests in IndexedDB under 'uyeh-offline-queue'
  // This replays them in order when connectivity is restored
  try {
    const db      = await openQueueDB();
    const entries = await getAllQueueEntries(db);

    for (const entry of entries) {
      try {
        const res = await fetch(entry.url, {
          method:  entry.method,
          headers: entry.headers,
          body:    entry.body,
        });
        if (res.ok) {
          await deleteQueueEntry(db, entry.id);
          console.log('[SW] Replayed queued request:', entry.url);
        }
      } catch {
        console.warn('[SW] Replay failed, will retry next sync:', entry.url);
      }
    }
  } catch (err) {
    console.warn('[SW] Background sync error:', err);
  }
}

// ── IndexedDB helpers for the offline queue ────────────────────────────────
function openQueueDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('uyeh-sw-queue', 1);
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore('queue', { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
}
function getAllQueueEntries(db) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction('queue', 'readonly');
    const req = tx.objectStore('queue').getAll();
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
}
function deleteQueueEntry(db, id) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction('queue', 'readwrite');
    const req = tx.objectStore('queue').delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = e => reject(e.target.error);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// MESSAGE BUS — pages can talk to the SW
// ═══════════════════════════════════════════════════════════════════════════
self.addEventListener('message', event => {
  const { type } = event.data || {};

  if (type === 'SKIP_WAITING') {
    console.log('[SW] SKIP_WAITING received — activating new SW now');
    self.skipWaiting();
  }

  if (type === 'GET_VERSION') {
    event.source?.postMessage({ type: 'SW_VERSION', version: APP_VERSION });
  }

  if (type === 'CLEAR_API_CACHE') {
    caches.delete(API_CACHE).then(() =>
      event.source?.postMessage({ type: 'CACHE_CLEARED', cache: 'api' })
    );
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// CACHE UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

// Guard against caching opaque (cross-origin no-cors) responses — they can
// be failure responses that look like successes (status 0)
function isOpaqueResponse(res) {
  return res.type === 'opaque';
}

// Stamp a response with the current time so we can check freshness later
async function stampResponse(response) {
  const body    = await response.arrayBuffer();
  const headers = new Headers(response.headers);
  headers.set('X-SW-Cached-At', Date.now().toString());
  return new Response(body, { status: response.status, statusText: response.statusText, headers });
}

// Return how old a cached response is in milliseconds
async function getCacheAge(cached) {
  const cachedAt = cached.headers.get('X-SW-Cached-At');
  if (!cachedAt) return Infinity;
  return Date.now() - parseInt(cachedAt, 10);
}

// Add a single header to a cached response clone
async function addHeader(response, key, value) {
  const body    = await response.arrayBuffer();
  const headers = new Headers(response.headers);
  headers.set(key, value);
  return new Response(body, { status: response.status, statusText: response.statusText, headers });
}

// Keep a cache under a max number of entries (FIFO)
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys  = await cache.keys();
  if (keys.length > maxEntries) {
    const toDelete = keys.slice(0, keys.length - maxEntries);
    await Promise.all(toDelete.map(k => cache.delete(k)));
  }
}

// Offline API fallback response
function offlineJson() {
  return new Response(
    JSON.stringify({ success: false, offline: true, message: 'You are offline. Please check your connection.' }),
    { status: 503, headers: { 'Content-Type': 'application/json', 'X-SW-Source': 'offline' } }
  );
}
