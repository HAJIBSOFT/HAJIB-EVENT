const CACHE_NAME = 'hajib-pwa-v15';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => k !== CACHE_NAME && caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('supabase.co')) return;
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});

// التفاعل عند نقر الموظف على الإشعار في هاتفه
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('index.html') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow('./index.html');
    })
  );
});
