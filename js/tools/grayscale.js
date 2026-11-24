import { h, t, stem, pdfLib, openPdf, renderPage } from '../core.js';
import { shell, field, seg, pageGrid } from '../ui.js';
import { singlePdf } from './_single.js';
import { rawPixels, toImageData, filterOf, components, isImage } from './_img.js';

const WS = new Set([0, 9, 10, 12, 13, 32]);
const DELIM = new Set([...'()<>[]{}/%'].map((c) => c.charCodeAt(0)));
const NUM = /^[+-]?(\d+\.?\d*|\.\d+)$/;
const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
const cmyk = (c, m, y, k) => 1 - Math.min(1, 0.299 * c + 0.587 * m + 0.114 * y + k);
const f = (x) => (Math.round(x * 1000) / 1000).toString();

/** Rewrite colour operators in a content stream to their gray equivalents. Strings and inline images are copied untouched. */
export function grayContent(src) {
  const out = [];
  let ops = []; // operand tokens since the last operator
  let i = 0;
  const n = src.length;
  const flush = (op) => {
    const v = ops.map((x) => x.s);
    const nums = ops.every((x) => x.num) ? v.map(Number) : null;
    let rep = null;
    const lower = op === op.toLowerCase();
    if ((op === 'rg' || op === 'RG') && nums?.length === 3) rep = f(lum(...nums)) + (lower ? ' g' : ' G');
    else if ((op === 'k' || op === 'K') && nums?.length === 4) rep = f(cmyk(...nums)) + (lower ? ' g' : ' G');
    else if (/^(sc|scn|SC|SCN)$/.test(op) && nums) {
      const sl = op[0] === 's';
      if (nums.length === 3) rep = f(lum(...nums)) + (sl ? ' g' : ' G');
      else if (nums.length === 4) rep = f(cmyk(...nums)) + (sl ? ' g' : ' G');
    }
    out.push(rep ?? [...v, op].join(' '), '\n');
    ops = [];
  };
  while (i < n) {
    const c = src.charCodeAt(i);
    if (WS.has(c)) { i++; continue; }
    if (c === 37) { while (i < n && src[i] !== '\n' && src[i] !== '\r') i++; continue; } // comment
    let s, start = i;
    if (c === 40) { // (string)
      let depth = 0;
      for (; i < n; i++) {
        const ch = src[i];
        if (ch === '\\') { i++; continue; }
        if (ch === '(') depth++;
        else if (ch === ')' && --depth === 0) { i++; break; }
      }
      s = src.slice(start, i);
    } else if (c === 60 && src[i + 1] === '<') { s = '<<'; i += 2; }
    else if (c === 62 && src[i + 1] === '>') { s = '>>'; i += 2; }
    else if (c === 60) { const e = src.indexOf('>', i); i = e < 0 ? n : e + 1; s = src.slice(start, i); }
    else if (c === 91 || c === 93 || c === 123 || c === 125) { s = src[i]; i++; }
    else if (c === 47) { i++; while (i < n && !WS.has(src.charCodeAt(i)) && !DELIM.has(src.charCodeAt(i))) i++; s = src.slice(start, i); }
    else {
      while (i < n && !WS.has(src.charCodeAt(i)) && !DELIM.has(src.charCodeAt(i))) i++;
      s = src.slice(start, i);
      if (!s) { i++; continue; }
      if (!NUM.test(s) && !/^(true|false|null)$/.test(s)) {
        if (s === 'ID') { // inline image: copy through to EI untouched
          const m = /\sEI(?=[\s]|$)/g; m.lastIndex = i + 1;
          const hit = m.exec(src);
          const end = hit ? hit.index + hit[0].length : n;
          out.push([...ops.map((x) => x.s), src.slice(start, end)].join(' '), '\n');
          ops = []; i = end; continue;
        }
        flush(s); continue;
      }
      ops.push({ s, num: NUM.test(s) }); continue;
    }
    ops.push({ s, num: false });
  }
  if (ops.length) out.push(ops.map((x) => x.s).join(' '));
  return out.join('');
}

const latin1 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return s; };
const bytesOf = (s) => { const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 255; return u; };

async function jpegGray(bmp, q = 0.88) {
  const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0);
  const id = g.getImageData(0, 0, c.width, c.height), p = id.data; // ctx.filter is missing in some Safari versions
  for (let i = 0; i < p.length; i += 4) p[i] = p[i + 1] = p[i + 2] = lum(p[i], p[i + 1], p[i + 2]);
  g.putImageData(id, 0, 0);
  const b = await new Promise((r) => c.toBlob(r, 'image/jpeg', q));
  return new Uint8Array(await b.arrayBuffer());
}

/** Keep text and vectors: rewrite colours in content streams and convert pictures. */
async function grayVector(doc, lib) {
  const { PDFName, PDFNumber, PDFRawStream, PDFArray, PDFHexString, PDFString, decodePDFRawStream } = lib;
  const ctx = doc.context;
  const contentRefs = new Set();
  for (const p of doc.getPages()) {
    const c = p.node.get(PDFName.of('Contents'));
    if (c instanceof PDFArray) c.asArray().forEach((r) => contentRefs.add(r.toString()));
    else if (c) contentRefs.add(c.toString());
  }
  const restream = (ref, obj, bytes) => {
    const ns = ctx.flateStream(bytes);
    for (const [k, v] of obj.dict.entries()) if (!['/Filter', '/DecodeParms', '/Length'].includes(k.toString())) ns.dict.set(k, v);
    ctx.assign(ref, ns);
  };
  let streams = 0, images = 0;
  for (const [ref, obj] of [...ctx.enumerateIndirectObjects()]) {
    if (!(obj instanceof PDFRawStream)) continue;
    const d = obj.dict;
    const sub = d.lookup(PDFName.of('Subtype'))?.toString();
    if (contentRefs.has(ref.toString()) || sub === '/Form') {
      try { restream(ref, obj, bytesOf(grayContent(latin1(decodePDFRawStream(obj).decode())))); streams++; } catch (e) { console.warn('content skipped', e); }
      continue;
    }
    if (!isImage(obj, lib)) continue;
    const cs = d.lookup(PDFName.of('ColorSpace'));
    if (cs instanceof PDFArray && cs.lookup(0)?.toString() === '/Indexed' && cs.lookup(1)?.toString() === '/DeviceRGB') {
      const lut = cs.lookup(3);
      let bytes = lut instanceof PDFHexString || lut instanceof PDFString ? lut.asBytes() : lut instanceof PDFRawStream ? decodePDFRawStream(lut).decode() : null;
      if (!bytes) continue;
      bytes = Uint8Array.from(bytes);
      for (let i = 0; i + 2 < bytes.length; i += 3) { const L = Math.round(lum(bytes[i], bytes[i + 1], bytes[i + 2])); bytes[i] = bytes[i + 1] = bytes[i + 2] = L; }
      const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
      const arr = PDFArray.withContext(ctx); [0, 1, 2].forEach((k) => arr.push(cs.get(k))); arr.push(PDFHexString.of(hex));
      d.set(PDFName.of('ColorSpace'), arr); images++;
      continue;
    }
    const filter = filterOf(d, lib);
    try {
      if (filter === '/DCTDecode' && components(d, lib) === 3) {
        const jpg = await jpegGray(await createImageBitmap(new Blob([obj.contents], { type: 'image/jpeg' })));
        const nd = d.clone(ctx); nd.set(PDFName.of('ColorSpace'), PDFName.of('DeviceRGB')); nd.delete(PDFName.of('Decode')); nd.set(PDFName.of('Length'), PDFNumber.of(jpg.length));
        ctx.assign(ref, PDFRawStream.of(nd, jpg)); images++;
      } else {
        const px = rawPixels(obj, lib);
        if (!px || px.n !== 3) continue;
        const gray = new Uint8Array(px.w * px.h);
        for (let i = 0, j = 0; i < gray.length; i++, j += 3) gray[i] = Math.round(lum(px.data[j], px.data[j + 1], px.data[j + 2]));
        const ns = ctx.flateStream(gray);
        for (const [k, v] of d.entries()) if (!['/Filter', '/DecodeParms', '/Length', '/ColorSpace', '/Decode'].includes(k.toString())) ns.dict.set(k, v);
        ns.dict.set(PDFName.of('ColorSpace'), PDFName.of('DeviceGray'));
        ctx.assign(ref, ns); images++;
      }
    } catch (e) { console.warn('image skipped', e); }
  }
  return { streams, images };
}

/** Sure-fire: render every page as a gray picture. Text is no longer selectable. */
async function grayRaster(ctx, lib) {
  const out = await lib.PDFDocument.create();
  for (let i = 1; i <= ctx.doc.numPages; i++) {
    const page = await ctx.doc.getPage(i);
    const vp = page.getViewport({ scale: 1 });
    const canvas = await renderPage(ctx.doc, i, (vp.width * 170 / 72) / Math.min(window.devicePixelRatio || 1, 2));
    const img = await out.embedJpg(await jpegGray(canvas, 0.82));
    out.addPage([vp.width, vp.height]).drawImage(img, { x: 0, y: 0, width: vp.width, height: vp.height });
  }
  return out;
}

export async function mount(root, tool) {
  let ctx, mode = 'vector';
  const ui = shell(root, {
    actionLabel: t({ id: 'Ubah jadi hitam putih', en: 'Convert to grayscale' }),
    panelTitle: t({ id: 'Cara konversi', en: 'Conversion' }),
    run: async () => {
      const lib = await pdfLib();
      let doc, summary;
      if (mode === 'vector') {
        doc = await openPdf(ctx.bytes);
        const r = await grayVector(doc, lib);
        summary = t({ id: 'Warna teks dan garis diubah ke abu-abu, {i} gambar dikonversi. Teks tetap bisa dipilih.', en: 'Text and line colours set to gray, {i} images converted. Text stays selectable.' }, { i: r.images });
      } else {
        doc = await grayRaster(ctx, lib);
        summary = t({ id: '{n} halaman diubah menjadi gambar abu-abu.', en: '{n} pages turned into gray images.' }, { n: doc.getPageCount() });
      }
      return { files: [{ name: stem(ctx.file.name) + '-hitamputih.pdf', data: await doc.save({ useObjectStreams: true }) }], summary };
    },
  });
  singlePdf(ui, tool, (c) => {
    ctx = c;
    const note = h('p', { class: 'note' });
    const notes = {
      vector: { id: 'Teks tetap tajam dan bisa disalin. Hampir semua PDF berubah sepenuhnya, tetapi gradasi warna yang jarang dipakai bisa tetap berwarna.', en: 'Text stays sharp and copyable. Almost every PDF turns fully gray, though rare colour gradients may keep their colour.' },
      raster: { id: 'Setiap halaman dijadikan gambar abu-abu, jadi pasti tidak ada warna tersisa. Teks tidak bisa dipilih lagi.', en: 'Every page becomes a gray picture, so no colour is left for sure. Text is no longer selectable.' },
    };
    const set = (v) => { mode = v; note.textContent = t(notes[v]); };
    ui.opts.append(seg([['vector', t({ id: 'Pertahankan teks', en: 'Keep text' })], ['raster', t({ id: 'Jadikan gambar', en: 'As images' })]], mode, set), note);
    set(mode);
    ui.stage.append(pageGrid({ pages: c.pages, mode: 'view' }).el);
    ui.setReady(true);
  });
}
