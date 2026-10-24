// Service worker INNOVER STORE.
// - Fichiers du site (_next/static), logo, icônes et photos produits : CACHE D'ABORD
//   (leur nom change à chaque modification, donc on peut les garder) → affichage instantané.
// - Pages HTML : réseau d'abord (toujours la dernière version), cache en secours hors-ligne.
// - Données Supabase (ventes, stock, connexion) : jamais mises en cache, toujours fraîches.
const CACHE = 'innover-store-v2';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) =>
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
);

const isStatic = (url) =>
  (url.origin === self.location.origin &&
    (url.pathname.startsWith('/_next/static/') ||
      url.pathname.startsWith('/icons/') ||
      /\.(jpg|jpeg|png|webp|svg|ico|woff2?)$/.test(url.pathname))) ||
  // Photos produits stockées dans Supabase Storage (nom de fichier unique)
  url.pathname.includes('/storage/v1/object/public/');

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (isStatic(url)) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok || res.type === 'opaque') {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
            }
            return res;
          })
      )
    );
    return;
  }

  // Pages du site : réseau d'abord, cache si pas de connexion.
  if (url.origin === self.location.origin && req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req))
    );
  }
  // Tout le reste (API Supabase…) : le navigateur gère normalement, sans cache.
});
