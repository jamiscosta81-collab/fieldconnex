// FieldConnex PWA — Service Worker
// Versão do cache — incrementar aqui para forçar atualização
const CACHE_NAME = 'fieldconnex-v1';

// Arquivos que serão cacheados para funcionar offline
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  // Fontes Google (cache externo)
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap'
];

// ─── INSTALL: cachear tudo na instalação ───
self.addEventListener('install', event => {
  console.log('[SW] Instalando e cacheando assets...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cachear assets locais (obrigatório)
      return cache.addAll([
        '/',
        '/index.html',
        '/manifest.json',
        '/icons/icon-192.png',
        '/icons/icon-512.png'
      ]).then(() => {
        // Tentar cachear fontes (opcional — pode falhar sem internet)
        return cache.add('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap')
          .catch(() => console.log('[SW] Fontes não cacheadas (sem internet na instalação)'));
      });
    }).then(() => {
      console.log('[SW] Cache concluído!');
      return self.skipWaiting();
    })
  );
});

// ─── ACTIVATE: limpar caches antigos ───
self.addEventListener('activate', event => {
  console.log('[SW] Ativando...');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Removendo cache antigo:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ─── FETCH: Cache First para assets, Network First para resto ───
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Ignorar requisições não-GET
  if (event.request.method !== 'GET') return;

  // Ignorar extensões de browser e chrome-extension
  if (url.protocol === 'chrome-extension:') return;

  // Estratégia: Cache First (serve do cache, atualiza em background)
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        // Servir do cache e atualizar em background
        const fetchUpdate = fetch(event.request)
          .then(response => {
            if (response && response.status === 200) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
            }
            return response;
          })
          .catch(() => {}); // silencioso se offline
        return cached;
      }

      // Não está no cache: buscar da rede
      return fetch(event.request)
        .then(response => {
          if (!response || response.status !== 200) return response;
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => {
          // Offline e não tem cache: retornar página principal
          if (event.request.destination === 'document') {
            return caches.match('/index.html');
          }
        });
    })
  );
});

// ─── MESSAGE: forçar atualização ───
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
