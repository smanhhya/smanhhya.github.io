// sw.js - محرك السرعة والعمل بدون إنترنت لموقع عملاء سمان ههيا (v12)
const CACHE_NAME = 'sman-hhya-store-v12';
const CDN_CACHE_NAME = 'sman-hhya-cdn-v12';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './track.html',
  './reviews.html',
  './css/style.css?v=10',
  './css/style.css',
  './js/config.js?v=8',
  './js/app.js?v=23',
  './js/floating-wa.js?v=1',
  './manifest.json',
  './logo.png'
];

const CDN_HOSTS = [
  'cdn.tailwindcss.com',
  'www.gstatic.com',
  'cdnjs.cloudflare.com',
  'cdn.jsdelivr.net',
  'fonts.googleapis.com',
  'fonts.gstatic.com'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(ASSETS_TO_CACHE.map((url) => cache.add(url).catch(() => null)))
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((cache) =>
          (cache !== CACHE_NAME && cache !== CDN_CACHE_NAME) ? caches.delete(cache) : null
        )
      )
    ).then(() => self.clients.claim())
  );
});

function fetchWithTimeout(req, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    fetch(req)
      .then((res) => { clearTimeout(timer); resolve(res); })
      .catch((err) => { clearTimeout(timer); reject(err); });
  });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = req.url;
  if (
    !url.startsWith('http') ||
    url.includes('firestore.googleapis.com') ||
    url.includes('identitytoolkit.googleapis.com') ||
    url.includes('securetoken.googleapis.com') ||
    url.includes('api.web3forms.com') ||
    url.includes('script.google.com')
  ) {
    return;
  }

  // 1. مكتبات الـ CDN والخطوط: من الكاش فوراً في 0ms مع تحديث صامت بالخلفية
  if (CDN_HOSTS.some((h) => url.includes(h))) {
    event.respondWith(
      caches.open(CDN_CACHE_NAME).then((cache) =>
        cache.match(req).then((cached) => {
          const netFetch = fetch(req).then((res) => {
            if (res && (res.ok || res.type === 'opaque')) {
              cache.put(req, res.clone()).catch(() => {});
            }
            return res;
          }).catch(() => cached);
          return cached || netFetch;
        })
      )
    );
    return;
  }

  // 2. صفحات HTML: محاولة جلب سريع خلال 1.5 ثانية لضمان أحدث إصدار، وإذا النت بطيء أو مقطوع يفتح الكاش فوراً
  const isHtmlNav = req.mode === 'navigate' || url.endsWith('.html') || url.endsWith('/');
  if (isHtmlNav && url.startsWith(self.location.origin)) {
    event.respondWith(
      fetchWithTimeout(req, 1500)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() =>
          caches.open(CACHE_NAME).then((c) =>
            c.match(req, { ignoreSearch: true }).then((m) => m || c.match('./index.html'))
          )
        )
    );
    return;
  }

  // 3. ملفات JS / CSS / الصور المحلية: فتح فوري من الكاش (Stale-While-Revalidate) لسرعة صاروخية
  if (url.startsWith(self.location.origin)) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(req).then((cached) => {
          const netFetch = fetch(req)
            .then((res) => {
              if (res && res.ok) {
                cache.put(req, res.clone()).catch(() => {});
              }
              return res;
            })
            .catch(() => cached || cache.match(req, { ignoreSearch: true }));
          return cached || netFetch;
        })
      )
    );
  }
});
