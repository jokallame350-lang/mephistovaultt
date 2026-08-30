// MephistoVault PWA Service Worker v2
const CACHE_NAME = 'mephistovault-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/favicon.png',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== 'mephistovault-shares') return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Handle Web Share Target POST request
  if (req.method === 'POST' && url.pathname === '/share-target') {
    event.respondWith(
      (async () => {
        try {
          const formData = await req.formData();
          const files = formData.getAll('files');
          const title = formData.get('title') || '';
          const text = formData.get('text') || '';
          const shareUrl = formData.get('url') || '';

          const cache = await caches.open('mephistovault-shares');
          const shareData = {
            title,
            text,
            url: shareUrl,
            hasFiles: files.length > 0,
            fileCount: files.length,
            timestamp: Date.now()
          };
          await cache.put(
            new Request('/shared-meta'),
            new Response(JSON.stringify(shareData), {
              headers: { 'Content-Type': 'application/json' }
            })
          );

          for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file && typeof file.arrayBuffer === 'function') {
              const fileBuffer = await file.arrayBuffer();
              await cache.put(
                new Request(`/shared-file-${i}`),
                new Response(fileBuffer, {
                  headers: {
                    'Content-Type': file.type || 'application/octet-stream',
                    'X-File-Name': encodeURIComponent(file.name || `shared-file-${i}`),
                    'X-File-Type': file.type || 'application/octet-stream'
                  }
                })
              );
            }
          }
          return Response.redirect('/?shared=true', 303);
        } catch {
          return Response.redirect('/', 303);
        }
      })()
    );
    return;
  }

  // Only handle standard HTTP/HTTPS GET requests on same-origin assets
  if (!url.protocol.startsWith('http') || req.method !== 'GET') return;

  // Bypass PeerJS, TURN/STUN, and cross-origin WebRTC signaling entirely
  if (
    url.origin !== self.location.origin ||
    url.hostname.includes('peerjs') ||
    url.hostname.includes('metered') ||
    url.pathname.includes('/peerjs')
  ) {
    return;
  }

  // 1. Navigation requests (HTML): Network-First with Cache fallback & update
  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const cacheCopy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, cacheCopy));
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(req).then((cachedResponse) => {
            return cachedResponse || caches.match('/index.html');
          });
        })
    );
    return;
  }

  // 2. Static Assets (JS, CSS, images, fonts): Cache-First with Network fallback & cache update
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      if (cachedResponse) {
        // Asynchronously update cache in background
        fetch(req)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(req, networkResponse));
            }
          })
          .catch(() => {});
        return cachedResponse;
      }

      return fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const cacheCopy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, cacheCopy));
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(req);
        });
    })
  );
});
