/* 日程管家 —— Service Worker（离线缓存 + 推送通知 + 通知点击） */
const CACHE = 'schedule-app-v3';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/nlparse.js',
  './js/app.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  // API 请求走网络
  if (e.request.url.includes('/api/')) return;
  // 网络优先：在线时永远拿最新（避免旧缓存导致功能/新逻辑不同步），离线时回退缓存
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res && res.status === 200 && e.request.url.startsWith(self.location.origin)) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() =>
        caches.match(e.request).then((cached) => cached || caches.match('./index.html'))
      )
  );
});

// 收到服务器推送
self.addEventListener('push', (e) => {
  let data = { title: '⏰ 日程提醒', body: '' };
  try { if (e.data) data = e.data.json(); } catch (err) { /* 忽略 */ }
  e.waitUntil(
    self.registration.showNotification(data.title || '⏰ 日程提醒', {
      body: data.body || '',
      tag: data.tag || 'schedule-remind',
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      renotify: true,
      vibrate: [200, 100, 200],
      data: { url: data.url || './index.html' },
    })
  );
});

// 点击通知
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './index.html';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clist) => {
      for (const c of clist) {
        if ('focus' in c) {
          c.focus();
          if ('navigate' in c && c.url !== url) c.navigate(url);
          return;
        }
      }
      return clients.openWindow(url);
    })
  );
});
