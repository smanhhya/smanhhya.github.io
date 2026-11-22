// sw.js - محرك السرعة والتخزين المؤقت الآمن (Network-First لملفات الكود لمنع تعليق التحديثات)
const CACHE_NAME = 'sman-hhya-store-v11';


const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './track.html',
  './reviews.html',
  './css/style.css',
  './js/config.js',
  './js/app.js',
  './js/floating-wa.js',
  './manifest.json'
];


self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        ASSETS_TO_CACHE.map((url) => cache.add(url).catch(() => null))
      );
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
          return null;
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = req.url;
  if (
    !url.startsWith('http') ||
    url.includes('firestore.googleapis.com') ||
    url.includes('identitytoolkit.googleapis.com') ||
    url.includes('securetoken.googleapis.com') ||
    url.includes('firebase')
  ) {
    return;
  }

  const isCodeOrPage =
    req.mode === 'navigate' ||
    url.includes('.html') ||
    url.includes('.js') ||
    url.includes('.css');

  // جلب النسخة الأحدث من الإنترنت أولاً لملفات الكود والصفحات، والرجوع للكاش فقط عند انقطاع النت
  if (isCodeOrPage) {
    event.respondWith(
      fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok && networkResponse.type === 'basic') {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
          }
          return networkResponse;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // استراتيجية سريعة للصور والأيقونات
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      const networkFetch = fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok && networkResponse.type === 'basic') {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || networkFetch;
    })
  );
});
