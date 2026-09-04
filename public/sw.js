const CACHE_NAME = 'cbmsc-ara-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Instala e cacheia assets estáticos
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(
      cache => cache.addAll(STATIC_ASSETS)
    )
  );
  self.skipWaiting();
});

// Limpa caches antigos ao ativar
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME)
            .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Estratégia: Network first para chamadas de API,
// Cache first para assets estáticos
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Requisições ao Supabase sempre vão para a rede — nunca cache
  if (
    url.hostname.includes('supabase') ||
    e.request.method !== 'GET'
  ) {
    return;
  }

  // Assets estáticos: cache first, com fallback para rede
  e.respondWith(
    caches.match(e.request).then(
      cached => cached ||
        fetch(e.request).then(response => {
          // Apenas cacheia respostas válidas
          if (!response || response.status !== 200 || response.type === 'opaque') {
            return response;
          }
          const clone = response.clone();
          caches.open(CACHE_NAME).then(
            cache => cache.put(e.request, clone)
          );
          return response;
        })
    )
  );
});
