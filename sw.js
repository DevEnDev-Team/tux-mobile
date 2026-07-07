const CACHE_NAME = 'tux-it-cache-v8';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './logo.png',
  './html5-qrcode.min.js'
];

// Installation du Service Worker et mise en cache des ressources statiques
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Forcer le téléchargement depuis le réseau sans utiliser le cache HTTP du navigateur
      const cachePromises = ASSETS.map((asset) => {
        const urlWithBust = asset === './' ? './?_cb=' + Date.now() : asset + '?_cb=' + Date.now();
        return fetch(new Request(urlWithBust, { cache: 'reload' }))
          .then((response) => {
            if (!response.ok) {
              throw new Error(`Le chargement de l'asset ${asset} a échoué avec le statut ${response.status}`);
            }
            // On stocke la réponse dans le cache sous la clé d'origine propre (sans le cache-bust)
            return cache.put(asset, response);
          });
      });
      return Promise.all(cachePromises);
    }).then(() => self.skipWaiting())
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
  // Ne pas intercepter les requêtes API vers le serveur de synchronisation
  if (e.request.url.includes('/api/')) {
    return;
  }

  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((cachedResponse) => {
      if (cachedResponse) {
        // Retourner la version en cache, et mettre à jour en arrière-plan (Stale-While-Revalidate)
        fetch(e.request).then((networkResponse) => {
          if (networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, networkResponse));
          }
        }).catch(() => {/* Ignorer l'erreur si hors ligne */});
        return cachedResponse;
      }
      return fetch(e.request);
    })
  );
});
