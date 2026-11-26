/* АнтиКамера PRO — service worker v2: офлайн-кэш + свежие обновления */
const CACHE = 'antikamera-pro-v34';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // API (проверка оплаты, отзывы) — всегда напрямую в сеть, не кэшируем
  try {
    const u = new URL(e.request.url);
    if (u.pathname.startsWith('/api/')) return;
    if (u.origin !== self.location.origin) return;
  } catch (_) { return; }

  // HTML-страницы: сперва сеть (пользователь всегда получает свежую версию),
  // офлайн — из кэша. Так обновления приложения приходят сразу.
  const isNavigate = e.request.mode === 'navigate' ||
    (e.request.headers.get('accept') || '').includes('text/html');
  if (isNavigate) {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      }).catch(() =>
        caches.match(e.request, { ignoreSearch: true })
          .then(c => c || caches.match('./')))
    );
    return;
  }

  // ассеты (иконки и т.п.) — cache-first
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      }).catch(() => caches.match('./'));
    })
  );
});
