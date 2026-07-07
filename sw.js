const CACHE_NAME = 'tux-it-cache-v13';
const ASSETS = [
  './',
  './index.html',
  './style.css?v=13',
  './app.js?v=13',
  './manifest.json?v=13',
  './logo.png?v=13',
  './html5-qrcode.min.js'
];

// Installation du Service Worker et mise en cache des ressources statiques
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      const cachePromises = ASSETS.map((asset) => {
        // Pour les fichiers non versionnés (la racine ou index.html), on force le réseau avec un paramètre de cache-bust
        if (asset === './' || asset === './index.html') {
          const urlWithBust = asset === './' ? './?_cb=' + Date.now() : asset + '?_cb=' + Date.now();
          return fetch(new Request(urlWithBust, { cache: 'reload' }))
            .then((response) => {
              if (!response.ok) {
                throw new Error(`Le chargement de ${asset} a échoué avec le statut ${response.status}`);
              }
              // On enregistre sous la clé propre (sans le cache-bust)
              return cache.put(asset, response);
            });
        } else {
          // Pour les autres assets (déjà versionnés ou statiques tiers), on force le rechargement réseau direct
          return fetch(new Request(asset, { cache: 'reload' }))
            .then((response) => {
              if (!response.ok) {
                throw new Error(`Le chargement de ${asset} a échoué avec le statut ${response.status}`);
              }
              return cache.put(asset, response);
            });
        }
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

// Interception des requêtes (Stratégie Cache-First stricte et ultra-robuste)
self.addEventListener('fetch', (e) => {
  // Ne pas intercepter les requêtes qui ne sont pas en HTTP ou HTTPS
  if (!e.request.url.startsWith('http://') && !e.request.url.startsWith('https://')) {
    return;
  }

  // Ne pas intercepter les requêtes API vers le serveur de synchronisation
  if (e.request.url.includes('/api/')) {
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      // Retourne le fichier en cache s'il correspond exactement à l'URL versionnée, sinon va sur le réseau
      return cachedResponse || fetch(e.request);
    })
  );
});
