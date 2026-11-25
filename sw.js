// Offline cache. Bump VERSION whenever files change so visitors get the update.
const VERSION = 'pdfdika-v6';
const FILES = [
  './',
  'css/style.css',
  'fonts/jakarta.woff2',
  'icons/apple-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon.svg',
  'icons/maskable-512.png',
  'icons/maskable.svg',
  'index.html',
  'js/app.js',
  'js/core.js',
  'js/reflow/engine.js',
  'js/reflow/export.js',
  'js/reflow/reader.js',
  'js/tools.js',
  'js/tools/_img.js',
  'js/tools/_ocr.js',
  'js/tools/_placer.js',
  'js/tools/_single.js',
  'js/tools/_viewer.js',
  'js/tools/addimage.js',
  'js/tools/addtext.js',
  'js/tools/blank.js',
  'js/tools/bookmarks.js',
  'js/tools/compare.js',
  'js/tools/compress.js',
  'js/tools/crop.js',
  'js/tools/delete.js',
  'js/tools/extract.js',
  'js/tools/extractimg.js',
  'js/tools/flatten.js',
  'js/tools/forms.js',
  'js/tools/grayscale.js',
  'js/tools/header.js',
  'js/tools/img2pdf.js',
  'js/tools/merge.js',
  'js/tools/metadata.js',
  'js/tools/numbers.js',
  'js/tools/nup.js',
  'js/tools/ocr.js',
  'js/tools/organize.js',
  'js/tools/pdf2excel.js',
  'js/tools/pdf2img.js',
  'js/tools/pdf2ppt.js',
  'js/tools/pdf2text.js',
  'js/tools/pdf2word.js',
  'js/tools/protect.js',
  'js/tools/redact.js',
  'js/tools/reflow.js',
  'js/tools/resize.js',
  'js/tools/reverse.js',
  'js/tools/rotate.js',
  'js/tools/scrub.js',
  'js/tools/sign.js',
  'js/tools/split.js',
  'js/tools/unlock.js',
  'js/tools/watermark.js',
  'js/ui.js',
  'manifest.webmanifest',
  'vendor/jszip.min.js',
  'vendor/pdf-lib.esm.min.js',
  'vendor/pdf.min.mjs',
  'vendor/pdf.worker.min.mjs',
];

self.addEventListener('install', (e) => {
  // Bypass the browser's HTTP cache so a new version never mixes old and new files.
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
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
    const net = fetch(req, { cache: 'no-cache' }).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  }));
});
