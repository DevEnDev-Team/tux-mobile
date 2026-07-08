const CACHE_NAME = 'tux-it-cache-v27';
const ASSETS = [
  './',
  './index.html',
  './css/style.css?v=27',
  './js/app.js?v=27',
  './manifest.json?v=27',
  './assets/logo.png?v=27',
  './js/html5-qrcode.min.js'
];

// Installation du Service Worker et mise en cache des ressources statiques
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activation et nettoyage des anciens caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
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

// Interception des requêtes
self.addEventListener('fetch', (e) => {
  // 0. Ne pas intercepter les requêtes qui ne sont pas des GET (évite l'erreur sur les POST/PUT/DELETE)
  if (e.request.method !== 'GET') {
    return;
  }

  // Ne pas intercepter les requêtes qui ne sont pas en HTTP ou HTTPS
  if (!e.request.url.startsWith('http://') && !e.request.url.startsWith('https://')) {
    return;
  }

  const url = new URL(e.request.url);

  // 1. NE PAS INTERCEPTER l'API de synchronisation (chemin contenant /notes ou /api/)
  if (url.pathname.includes('/notes') || e.request.url.includes('/notes') || e.request.url.includes('/api/')) {
    return;
  }

  // 2. NE PAS INTERCEPTER les requêtes cross-origin (vers un autre port ou un autre domaine)
  if (url.origin !== self.location.origin) {
    return;
  }

  // 3. STRATÉGIE NETWORK-FIRST pour la racine et index.html
  if (url.pathname === '/' || url.pathname === '/index.html') {
    e.respondWith(
      fetch(e.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // En cas de panne réseau (hors-ligne), on sert la version du cache
        return caches.match(e.request);
      })
    );
  } else {
    // 4. STRATÉGIE CACHE-FIRST pour les autres ressources statiques (déjà versionnées)
    e.respondWith(
      caches.match(e.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        
        return fetch(e.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(e.request, responseToCache);
            });
          }
          return networkResponse;
        }).catch((err) => {
          return new Response('Ressource indisponible', { status: 503, statusText: 'Service Unavailable' });
        });
      })
    );
  }
});
