const CACHE_NAME = 'sman-hhya-v2';

// تثبيت فوري بدون انتظار تحميل كل الملفات
self.addEventListener('install', (e) => {
  self.skipWaiting(); 
});

// سيطرة فورية على المتصفح
self.addEventListener('activate', (e) => {
  e.waitUntil(clients.claim()); 
});

// تلبية متطلبات التطبيق (الرد على طلبات المتصفح)
self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request).catch(() => {
      return caches.match(e.request);
    })
  );
});
