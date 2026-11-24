// Offline cache. Bump VERSION whenever files change so visitors get the update.
const VERSION = 'pdfdika-v1';
const FILES = [
  './',
  'css/style.css',
  'fonts/bricolage.woff2',
  'icons/apple-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon.svg',
  'icons/maskable-512.png',
  'index.html',
  'js/app.js',
  'js/core.js',
  'js/tools.js',
  'js/tools/_placer.js',
  'js/tools/_single.js',
  'js/tools/addimage.js',
  'js/tools/addtext.js',
  'js/tools/blank.js',
  'js/tools/delete.js',
  'js/tools/extract.js',
  'js/tools/img2pdf.js',
  'js/tools/merge.js',
  'js/tools/metadata.js',
  'js/tools/numbers.js',
  'js/tools/nup.js',
  'js/tools/organize.js',
  'js/tools/pdf2img.js',
  'js/tools/pdf2text.js',
  'js/tools/reverse.js',
  'js/tools/rotate.js',
  'js/tools/scrub.js',
  'js/tools/sign.js',
  'js/tools/split.js',
  'js/tools/watermark.js',
  'js/ui.js',
  'manifest.webmanifest',
  'vendor/jszip.min.js',
  'vendor/pdf-lib.esm.min.js',
  'vendor/pdf.min.mjs',
  'vendor/pdf.worker.min.mjs',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Stale-while-revalidate for same-origin GETs: instant from cache, refreshed in the background.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.open(VERSION).then(async (cache) => {
    const hit = await cache.match(req, { ignoreSearch: true });
    const net = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  }));
});
