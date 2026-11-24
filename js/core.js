// Shared helpers: language, DOM building, PDF libraries, downloads, page ranges.

const LS = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } },
};
export { LS };

let lang = LS.get('pdfdika.lang') || ((navigator.language || 'id').toLowerCase().startsWith('id') ? 'id' : 'en');
export const getLang = () => lang;
export function setLang(l) { lang = l; LS.set('pdfdika.lang', l); document.documentElement.lang = l; }
document.documentElement.lang = lang;

/** Translate: accepts {id, en} objects or plain strings. Supports {name} placeholders. */
export function t(o, vars) {
  let s = o == null ? '' : (typeof o === 'string' ? o : (o[lang] ?? o.id ?? ''));
  if (vars) for (const k in vars) s = s.split('{' + k + '}').join(vars[k]);
  return s;
}

/** Tiny element builder. h('div', {class:'x', onclick}, child, 'text') */
export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}
export const $ = (s, r = document) => r.querySelector(s);

export function svg(path, cls) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${cls ? ` class="${cls}"` : ''}>${path}</svg>`;
}
export function icon(path, cls) { const s = document.createElement('span'); s.innerHTML = svg(path, cls); return s.firstChild; }

export const I = {
  upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  grip: '<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  left: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  right: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  rotR: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  rotL: '<path d="M4 11a8 8 0 1 1 2.3 5.7"/><path d="M4 4v7h7"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>',
  download: '<path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 20h16"/>',
  back: '<path d="M15 6l-6 6 6 6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
};

// ---------- Libraries (loaded on demand, all from this site) ----------
let _pdfLib, _pdfjs, _zip;
export async function pdfLib() { return _pdfLib ||= await import('../vendor/pdf-lib.esm.min.js'); }
export async function pdfjs() {
  if (!_pdfjs) {
    _pdfjs = await import('../vendor/pdf.min.mjs');
    _pdfjs.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdf.worker.min.mjs', import.meta.url).href;
  }
  return _pdfjs;
}
export function JSZip() {
  if (_zip) return _zip;
  return _zip = new Promise((res, rej) => {
    if (window.JSZip) return res(window.JSZip);
    const s = document.createElement('script');
    s.src = new URL('../vendor/jszip.min.js', import.meta.url).href;
    s.onload = () => res(window.JSZip); s.onerror = rej;
    document.head.append(s);
  });
}

export const readBytes = (file) => file.arrayBuffer().then((b) => new Uint8Array(b));

export class UserError extends Error {}

/** Open a PDF with pdf-lib and turn library errors into plain messages. */
export async function openPdf(bytes) {
  const { PDFDocument } = await pdfLib();
  try {
    return await PDFDocument.load(bytes, { updateMetadata: false });
  } catch (e) {
    if (/encrypt/i.test(e.message)) {
      throw new UserError(t({ id: 'PDF ini dikunci kata sandi. Buka kuncinya dulu, lalu coba lagi.', en: 'This PDF is password-protected. Unlock it first, then try again.' }));
    }
    throw new UserError(t({ id: 'File ini tidak bisa dibaca sebagai PDF. Pastikan file tidak rusak.', en: 'This file could not be read as a PDF. Check that it is not damaged.' }));
  }
}

/** pdf.js document for previews (copy bytes: pdf.js transfers the buffer). */
export async function openPreview(bytes) {
  const lib = await pdfjs();
  return lib.getDocument({ data: bytes.slice(0), isEvalSupported: false }).promise;
}

/** Render a page to a canvas, sized to the given CSS width. */
export async function renderPage(doc, pageNo, cssWidth, rotation = 0) {
  const page = await doc.getPage(pageNo);
  const base = page.getViewport({ scale: 1, rotation: (page.rotate + rotation) % 360 });
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const scale = (cssWidth / base.width) * dpr;
  const vp = page.getViewport({ scale, rotation: (page.rotate + rotation) % 360 });
  const c = document.createElement('canvas');
  c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
  await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
  return c;
}

export function download(data, name, type = 'application/pdf') {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function fmtSize(n) {
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n / 1024).toFixed(0) + ' KB';
  return (n / 1048576).toFixed(1) + ' MB';
}
export const stem = (name) => name.replace(/\.[^.]+$/, '');

/** "1-3, 5, 8-" → [[1,2,3],[5],[8..max]] (1-based). Throws UserError on bad input. */
export function parseRanges(str, max) {
  const groups = [];
  for (const part of str.split(/[,;]+/).map((s) => s.trim()).filter(Boolean)) {
    const m = part.match(/^(\d*)\s*[-–]\s*(\d*)$/);
    let a, b;
    if (m) { a = m[1] ? +m[1] : 1; b = m[2] ? +m[2] : max; }
    else if (/^\d+$/.test(part)) { a = b = +part; }
    else throw new UserError(t({ id: `“${part}” bukan rentang halaman. Contoh: 1-3, 5`, en: `“${part}” is not a page range. Example: 1-3, 5` }));
    if (a < 1 || b > max || a > b) throw new UserError(t({ id: `Rentang ${part} di luar halaman 1–${max}.`, en: `Range ${part} is outside pages 1–${max}.` }));
    const g = []; for (let i = a; i <= b; i++) g.push(i); groups.push(g);
  }
  if (!groups.length) throw new UserError(t({ id: 'Tulis halaman yang dipilih, misalnya 1-3, 5.', en: 'Enter the pages to use, for example 1-3, 5.' }));
  return groups;
}

export function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** Replace characters the standard PDF fonts can't encode. */
export function winAnsiSafe(s) {
  return s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[–—]/g, '-').replace(/[^\x20-\x7E\xA0-\xFF\n]/g, '?');
}

let toastTimer;
export function toast(msg, err) {
  const el = $('#toast');
  el.textContent = msg; el.className = 'toast show' + (err ? ' err' : '');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (el.className = 'toast' + (err ? ' err' : '')), err ? 6000 : 3000);
}
export function reportError(e) {
  if (e instanceof UserError) console.warn(e.message); else console.error(e);
  toast(e instanceof UserError ? e.message : t({ id: 'Proses gagal: ', en: 'Processing failed: ' }) + (e?.message || e), true);
}

/** Files handed over from the home page drop target to the chosen tool. */
export const handoff = { files: null };

// ---------- Heavy WebAssembly tools, loaded only when a tool needs them ----------
function loadScript(rel) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = new URL(rel, import.meta.url).href; s.onload = res; s.onerror = () => rej(new Error('Gagal memuat ' + rel));
    document.head.append(s);
  });
}

let _tess;
/** Tesseract OCR worker for the given languages ("ind+eng"). */
export async function ocrWorker(langs, onProgress) {
  if (!window.Tesseract) await loadScript('../vendor/tesseract/tesseract.min.js');
  const base = new URL('../vendor/tesseract/', import.meta.url).href;
  if (_tess && _tess.langs === langs) return _tess.worker;
  if (_tess) await _tess.worker.terminate();
  const worker = await window.Tesseract.createWorker(langs.split('+'), 1, {
    workerPath: base + 'worker.min.js', corePath: base + 'core', langPath: base + 'lang',
    workerBlobURL: false,
    logger: (m) => onProgress?.(m),
  });
  _tess = { langs, worker };
  return worker;
}

let _qpdf;
/** qpdf compiled to WebAssembly. run(args, inputBytes) → output bytes. */
export async function qpdf() {
  if (!_qpdf) {
    const prev = window.Module;
    await loadScript('../vendor/qpdf/qpdf.js');
    const create = window.Module; window.Module = prev;
    _qpdf = create;
  }
  // a fresh instance per run keeps the in-memory file system clean
  const inst = await _qpdf({ locateFile: () => new URL('../vendor/qpdf/qpdf.wasm', import.meta.url).href, noInitialRun: true, print: () => {}, printErr: (e) => (inst._err = (inst._err || '') + e + '\n') });
  return {
    run(args, input) {
      inst.FS.writeFile('/in.pdf', input);
      let code;
      try { code = inst.callMain([...args.map((a) => (a === '{in}' ? '/in.pdf' : a === '{out}' ? '/out.pdf' : a))]); }
      catch (e) { code = e?.status ?? 2; }
      if (code !== 0 && code !== 3) { const err = new Error(inst._err || 'qpdf ' + code); err.code = code; throw err; }
      return inst.FS.readFile('/out.pdf');
    },
  };
}
