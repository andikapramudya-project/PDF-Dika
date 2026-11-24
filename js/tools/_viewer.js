// One page at a time, with an overlay layer for drawing boxes (crop, redact).
// Boxes are kept as fractions of the page as it looks on screen (rotation applied).
import { h, t, svg, I, renderPage } from '../core.js';

export function viewer(doc, { onPage = () => {}, hint } = {}) {
  let pageNo = 1;
  const wrap = h('div', { class: 'canvas-wrap' });
  const layer = h('div', { class: 'vlayer' });
  const label = h('span', { class: 'count' });
  const prev = h('button', { class: 'mini', type: 'button', 'aria-label': t({ id: 'Halaman sebelumnya', en: 'Previous page' }), html: svg(I.left), onclick: () => go(pageNo - 1) });
  const next = h('button', { class: 'mini', type: 'button', 'aria-label': t({ id: 'Halaman berikutnya', en: 'Next page' }), html: svg(I.right), onclick: () => go(pageNo + 1) });
  const el = h('div', { class: 'placer' }, h('div', { class: 'placer-nav' }, prev, label, next), hint && h('p', { class: 'note' }, hint), wrap);

  async function go(n) {
    if (n < 1 || n > doc.numPages) return;
    pageNo = n;
    const avail = Math.min(el.clientWidth || 640, 760);
    const canvas = await renderPage(doc, n, avail);
    canvas.style.width = avail + 'px';
    wrap.style.width = avail + 'px';
    layer.replaceChildren();
    wrap.replaceChildren(canvas, layer);
    label.textContent = t({ id: 'Halaman {n} dari {t}', en: 'Page {n} of {t}' }, { n, t: doc.numPages });
    prev.disabled = n === 1; next.disabled = n === doc.numPages;
    onPage(n, layer);
  }

  /** Let the user drag out a rectangle; calls done({x0,y0,x1,y1}) in fractions. */
  function drawBoxes(done) {
    let start = null, ghost = null;
    const pt = (e) => { const r = layer.getBoundingClientRect(); return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))]; };
    layer.addEventListener('pointerdown', (e) => {
      if (e.target !== layer) return;
      start = pt(e); layer.setPointerCapture(e.pointerId);
      ghost = h('div', { class: 'vbox ghost' }); layer.append(ghost);
    });
    layer.addEventListener('pointermove', (e) => {
      if (!start) return;
      const [x, y] = pt(e);
      place(ghost, { x0: Math.min(start[0], x), y0: Math.min(start[1], y), x1: Math.max(start[0], x), y1: Math.max(start[1], y) });
    });
    const end = (e) => {
      if (!start) return;
      const [x, y] = pt(e); const s = start; start = null; ghost?.remove();
      const b = { x0: Math.min(s[0], x), y0: Math.min(s[1], y), x1: Math.max(s[0], x), y1: Math.max(s[1], y) };
      if (b.x1 - b.x0 > 0.008 && b.y1 - b.y0 > 0.004) done(b);
    };
    layer.addEventListener('pointerup', end);
    layer.addEventListener('pointercancel', () => { start = null; ghost?.remove(); });
  }

  return { el, go, drawBoxes, layer, get page() { return pageNo; } };
}

export function place(el, b) {
  Object.assign(el.style, { left: b.x0 * 100 + '%', top: b.y0 * 100 + '%', width: (b.x1 - b.x0) * 100 + '%', height: (b.y1 - b.y0) * 100 + '%' });
}

/** Convert a box in on-screen fractions to PDF user space [x, y, w, h] for a pdf.js page. */
export function toPdfRect(page, b) {
  const vp = page.getViewport({ scale: 1 });
  const [ax, ay] = vp.convertToPdfPoint(b.x0 * vp.width, b.y0 * vp.height);
  const [bx, by] = vp.convertToPdfPoint(b.x1 * vp.width, b.y1 * vp.height);
  return [Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), Math.abs(by - ay)];
}

/** Bounding box of non-white content on a rendered canvas, as fractions, or null if blank. */
export function contentBox(canvas, pad = 0.012) {
  const { width: w, height: hh } = canvas;
  const d = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, hh).data;
  let x0 = w, y0 = hh, x1 = -1, y1 = -1;
  for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (d[i + 3] > 0 && d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11 < 240) {
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return null;
  return { x0: Math.max(0, x0 / w - pad), y0: Math.max(0, y0 / hh - pad), x1: Math.min(1, (x1 + 1) / w + pad), y1: Math.min(1, (y1 + 1) / hh + pad) };
}
