const CACHE_NAME = 'sman-hhya-v3'; // رفعنا رقم الإصدار عشان يجبر أجهزة العملاء تتحدث

// 1. الملفات الأساسية اللي عايزين المتصفح يحفظها عشان يفتح الموقع طلقة
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './css/style.css',
  './js/config.js',
  './js/app.js',
  './manifest.json'
];

// 2. تثبيت فوري وتحميل الملفات في الذاكرة
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// 3. تنظيف الذاكرة القديمة للعملاء اللي فتحوا الموقع قبل كده
self.addEventListener('activate', (e) => {
  e.waitUntil(clients.claim());
  e.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

// 4. استراتيجية (Stale-While-Revalidate) للسرعة الصاروخية
self.addEventListener('fetch', (e) => {
  // نتجاهل طلبات قاعدة البيانات (Firebase) عشان دايماً تيجي لايف
  if (e.request.method !== 'GET' || e.request.url.includes('firestore.googleapis.com')) return;

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      // لو الملف في الذاكرة هنعرضه فوراً (صفر ثانية)، وفي نفس الوقت نحدثه من النت في الخلفية
      const fetchPromise = fetch(e.request).then((networkResponse) => {
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(e.request, networkResponse.clone());
        });
        return networkResponse;
      }).catch(() => {
        // لو النت فاصل تماماً، مفيش مشكلة الموقع هيشتغل من الكاش
      });
      
      // اعرض المحفوظ في الذاكرة أولاً، لو مش موجود استنى النت
      return cachedResponse || fetchPromise;
    })
  );
});
