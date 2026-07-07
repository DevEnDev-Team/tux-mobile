const CACHE_NAME = 'tux-it-cache-v14';
const ASSETS = [
  './',
  './index.html',
  './style.css?v=14',
  './app.js?v=14',
  './manifest.json?v=14',
  './logo.png?v=14',
  './html5-qrcode.min.js'
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

// Interception des requêtes (Stratégie Mixte Network-First / Cache-First)
self.addEventListener('fetch', (e) => {
  // Ne pas intercepter les requêtes qui ne sont pas en HTTP ou HTTPS
  if (!e.request.url.startsWith('http://') && !e.request.url.startsWith('https://')) {
    return;
  }

  // Ne pas intercepter les requêtes API vers le serveur de synchronisation
  if (e.request.url.includes('/api/')) {
    return;
  }

  const url = new URL(e.request.url);

  // 1. STRATÉGIE NETWORK-FIRST pour la racine et index.html
  // Garantit qu'en ligne, l'utilisateur a TOUJOURS le dernier index.html (et donc les bons v=XX)
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
    // 2. STRATÉGIE CACHE-FIRST pour les autres ressources statiques (déjà versionnées)
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
        });
      })
    );
  }
});
