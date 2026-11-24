import { h, t, stem, pdfjs, JSZip } from '../core.js';
import { shell, field, seg } from '../ui.js';
import { singlePdf } from './_single.js';

const getObj = (store, id) => new Promise((resolve) => {
  let done = false;
  const timer = setTimeout(() => { if (!done) resolve(null); }, 4000);
  try { store.get(id, (v) => { done = true; clearTimeout(timer); resolve(v); }); } catch { resolve(null); }
});

/** Turn a pdf.js image object into a canvas. */
function toCanvas(img) {
  if (!img?.width || !img?.height) return null;
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d');
  if (img.bitmap) { g.drawImage(img.bitmap, 0, 0); return c; }
  if (!img.data) return null;
  const out = g.createImageData(img.width, img.height), o = out.data, d = img.data, n = img.width * img.height;
  if (img.kind === 3) o.set(d.subarray(0, n * 4));
  else if (img.kind === 2) for (let i = 0, j = 0; i < n; i++, j += 3) { o[i * 4] = d[j]; o[i * 4 + 1] = d[j + 1]; o[i * 4 + 2] = d[j + 2]; o[i * 4 + 3] = 255; }
  else if (img.kind === 1) {
    const row = (img.width + 7) >> 3;
    for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
      const v = (d[y * row + (x >> 3)] >> (7 - (x & 7))) & 1 ? 255 : 0, p = (y * img.width + x) * 4;
      o[p] = o[p + 1] = o[p + 2] = v; o[p + 3] = 255;
    }
  } else return null;
  g.putImageData(out, 0, 0);
  return c;
}

function thumb(src) {
  const s = Math.min(1, 240 / Math.max(src.width, src.height));
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(src.width * s)); c.height = Math.max(1, Math.round(src.height * s));
  c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  return c;
}

/** Collect every picture drawn on the pages, skipping tiny ones and repeats. */
async function collect(pdf, onPage) {
  const { OPS } = await pdfjs();
  const seen = new Set(), found = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const ops = await page.getOperatorList();
    for (let k = 0; k < ops.fnArray.length; k++) {
      const fn = ops.fnArray[k], args = ops.argsArray[k];
      let img = null, key = null;
      if (fn === OPS.paintImageXObject || fn === OPS.paintImageXObjectRepeat) {
        key = args[0];
        if (seen.has(key)) continue;
        img = await getObj(key.startsWith('g_') ? page.commonObjs : page.objs, key);
      } else if (fn === OPS.paintInlineImageXObject) img = args[0];
      else continue;
      if (!img || img.width < 24 || img.height < 24) continue;
      const canvas = toCanvas(img);
      if (!canvas) continue;
      const sig = `${img.width}x${img.height}:` + canvas.getContext('2d').getImageData(0, 0, Math.min(8, img.width), 1).data.join(',');
      if (seen.has(sig)) continue;
      if (key) seen.add(key);
      seen.add(sig);
      found.push({ canvas, page: i, w: img.width, h: img.height });
    }
    page.cleanup();
    onPage?.(i, pdf.numPages);
  }
  return found;
}

export async function mount(root, tool) {
  let ctx, found = [], fmt = 'jpg';
  const ui = shell(root, {
    actionLabel: t({ id: 'Unduh gambar', en: 'Download images' }),
    panelTitle: t({ id: 'Format', en: 'Format' }),
    run: async () => {
      const pick = found.filter((f) => f.on);
      const type = fmt === 'png' ? 'image/png' : 'image/jpeg';
      const files = [];
      for (let i = 0; i < pick.length; i++) {
        const f = pick[i];
        let c = f.canvas;
        if (fmt === 'jpg') { // flatten transparency onto white
          c = document.createElement('canvas'); c.width = f.w; c.height = f.h;
          const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, f.w, f.h); g.drawImage(f.canvas, 0, 0);
        }
        const blob = await new Promise((r) => c.toBlob(r, type, 0.92));
        files.push({ name: `${stem(ctx.file.name)}-hal${f.page}-${i + 1}.${fmt}`, data: blob, type });
      }
      if (files.length > 1) {
        const zip = new (await JSZip())();
        files.forEach((f) => zip.file(f.name, f.data));
        files.unshift({ name: stem(ctx.file.name) + '-gambar.zip', data: await zip.generateAsync({ type: 'blob' }), type: 'application/zip' });
      }
      return { files, summary: t({ id: '{n} gambar diambil dari PDF.', en: '{n} images taken from the PDF.' }, { n: pick.length }) };
    },
  });
  singlePdf(ui, tool, async (c) => {
    ctx = c;
    const bar = h('i'), status = h('p', { class: 'note' }, t({ id: 'Mencari gambar…', en: 'Looking for images…' }));
    const prog = h('div', { class: 'progress' }, bar);
    ui.stage.append(status, prog);
    found = await collect(c.doc, (i, n) => { bar.style.width = (i / n) * 100 + '%'; });
    prog.remove();
    if (!found.length) {
      status.textContent = t({ id: 'Tidak ada gambar di PDF ini. Kalau halamannya hasil scan, pakai PDF ke gambar untuk menyimpan tiap halaman.', en: 'There are no images in this PDF. If the pages are scans, use PDF to images to save each page.' });
      return;
    }
    found.forEach((f) => (f.on = true));
    const count = h('p', null);
    const upd = () => { const n = found.filter((f) => f.on).length; count.textContent = t({ id: '{n} dari {t} gambar dipilih.', en: '{n} of {t} images selected.' }, { n, t: found.length }); ui.setReady(n > 0); };
    status.textContent = t({ id: 'Klik gambar untuk melewatinya.', en: 'Click an image to leave it out.' });
    ui.stage.append(h('div', { class: 'imggrid' }, found.map((f) => {
      const card = h('button', { type: 'button', class: 'imgcard on', 'aria-pressed': 'true', onclick: () => { f.on = !f.on; card.classList.toggle('on', f.on); card.setAttribute('aria-pressed', String(f.on)); upd(); } },
        thumb(f.canvas), h('span', null, t({ id: 'Hal. {p} · {w}×{h}', en: 'p. {p} · {w}×{h}' }, { p: f.page, w: f.w, h: f.h })));
      return card;
    })));
    ui.opts.append(seg([['jpg', 'JPG'], ['png', t({ id: 'PNG (tanpa kompresi)', en: 'PNG (lossless)' })]], fmt, (v) => (fmt = v)), count,
      h('p', { class: 'note' }, t({ id: 'Gambar disimpan dalam resolusi aslinya seperti yang tersimpan di PDF.', en: 'Images are saved at the resolution stored inside the PDF.' })));
    upd();
  });
}
