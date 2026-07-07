const CACHE_NAME = 'tux-it-cache-v12';
const ASSETS = [
  './',
  './index.html',
  './style.css?v=12',
  './app.js?v=12',
  './manifest.json?v=12',
  './logo.png?v=12',
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
