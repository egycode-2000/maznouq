// Offline support: caches the app shell so مزنوق opens without internet.
const CACHE = 'maznouq-shell-v10';
const SHELL = [
  './',
  './index.html',
  './css/style.css',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './src/app.js',
  './src/controller.js',
  './src/views.js',
  './src/state.js',
  './src/ledger.js',
  './src/setup.js',
  './src/storage.js',
  './src/format.js',
  './src/obligations.js',
  './src/bills.js',
  './src/debts.js',
  './src/moves.js',
  './src/reports.js',
  './src/archive.js',
  './src/calc.js',
  './src/calcui.js',
  './src/borrows.js',
  './src/places.js',
  './src/people.js',
  './src/daily.js',
  './src/log.js',
  './src/ui/common.js',
  './src/ui/examples.js',
  './src/ui/home.js',
  './src/ui/money.js',
  './src/ui/safes.js',
  './src/ui/dues.js',
  './src/ui/accounts.js',
  './src/ctl/core.js',
  './src/ctl/setup.js',
  './src/ctl/money.js',
  './src/ctl/places.js',
  './src/ctl/dues.js',
  './src/ctl/accounts.js',
  './src/ctl/system.js',
  './src/lock.js',
  './src/photos.js',
  './src/count.js',
  './src/ui/lock.js',
  './src/ui/count.js',
  './src/ctl/security.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((hit) => hit || fetch(event.request))
  );
});
