const CACHE_NAME = 'tux-it-cache-v16';
const ASSETS = [
  './',
  './index.html',
  './style.css?v=16',
  './app.js?v=16',
  './manifest.json?v=16',
  './logo.png?v=16',
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

// Interception des requêtes (Stratégie Mixte Network-First / Cache-First robuste)
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
        }).catch((err) => {
          // Gestion des échecs réseau (ex: favicon.ico manquant, 404, connexion coupée)
          // Évite le crash du Service Worker en retournant une réponse vide
          return new Response('Ressource indisponible', { status: 503, statusText: 'Service Unavailable' });
        });
      })
    );
  }
});
