/*
 * ProlineMarketsFX service worker.
 *
 * Deliberately minimal. This is a live trading platform: a stale quote, a
 * stale position list or a cached authenticated page is worse than no cache
 * at all, so the ONLY thing cached here is content-hashed static output.
 * Everything else — documents, API, WebSocket upgrades — goes straight to the
 * network and is never stored.
 *
 * Chrome requires a registered service worker with a fetch handler before it
 * will offer the address-bar install button, which is the reason this exists.
 *
 * Bump CACHE_VERSION whenever the caching rules below change.
 */
const CACHE_VERSION = 'v1';
const STATIC_CACHE = `proline-static-${CACHE_VERSION}`;

// Content-hashed or otherwise immutable assets. Safe to serve from cache.
const CACHEABLE_PREFIXES = ['/_next/static/', '/icons/', '/images/', '/fonts/'];

// Never touched by the worker under any circumstance.
const BYPASS_PREFIXES = ['/api/', '/admin-api/', '/ws/', '/charting_library/', '/datafeeds/'];

self.addEventListener('install', (event) => {
  // Take over as soon as the new worker is ready rather than waiting for every
  // tab to close — the platform already fights stale JS after redeploys.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((n) => n.startsWith('proline-static-') && n !== STATIC_CACHE).map((n) => caches.delete(n))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only ever consider plain same-origin GETs.
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;

  if (BYPASS_PREFIXES.some((p) => url.pathname.startsWith(p))) return;

  // Navigations always hit the network so an authenticated page is never
  // served from cache — including to a different user on a shared machine.
  if (request.mode === 'navigate') return;

  if (!CACHEABLE_PREFIXES.some((p) => url.pathname.startsWith(p))) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      const hit = await cache.match(request);
      if (hit) return hit;

      const response = await fetch(request);
      // Only store clean, complete, same-origin responses.
      if (response.ok && response.type === 'basic') {
        cache.put(request, response.clone());
      }
      return response;
    })()
  );
});
