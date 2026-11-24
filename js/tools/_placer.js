// Place images or text on PDF pages by clicking, then drag to move and pull the corner to resize.
import { h, t, svg, I, pdfLib, openPdf, renderPage, hexToRgb, winAnsiSafe, stem } from '../core.js';

export function placer(ctx, { getStamp, onChange = () => {} }) {
  const items = []; // {page, kind:'image'|'text', fx, fy, fw, fh, png, text, size, color, bold, ratio}
  let pageNo = 1, scale = 1, vw = 0, vh = 0; // scale = CSS px per PDF point
  const wrap = h('div', { class: 'canvas-wrap' });
  const label = h('span', { class: 'count' });
  const prev = h('button', { class: 'mini', type: 'button', 'aria-label': t({ id: 'Halaman sebelumnya', en: 'Previous page' }), html: svg(I.left), onclick: () => go(pageNo - 1) });
  const next = h('button', { class: 'mini', type: 'button', 'aria-label': t({ id: 'Halaman berikutnya', en: 'Next page' }), html: svg(I.right), onclick: () => go(pageNo + 1) });
  const hint = h('p', { class: 'note' }, t({ id: 'Klik di halaman untuk menempatkan. Seret untuk memindah, tarik sudut biru untuk mengubah ukuran.', en: 'Click on the page to place. Drag to move, pull the blue corner to resize.' }));
  const el = h('div', { class: 'placer' }, h('div', { class: 'placer-nav' }, prev, label, next), hint, wrap);

  async function go(n) {
    if (n < 1 || n > ctx.doc.numPages) return;
    pageNo = n;
    const page = await ctx.doc.getPage(n);
    const vp = page.getViewport({ scale: 1 });
    vw = vp.width; vh = vp.height;
    const avail = Math.min(el.clientWidth || 640, 760);
    const canvas = await renderPage(ctx.doc, n, avail);
    canvas.style.width = avail + 'px';
    scale = avail / vw;
    wrap.style.width = avail + 'px';
    wrap.replaceChildren(canvas);
    label.textContent = t({ id: 'Halaman {n} dari {t}', en: 'Page {n} of {t}' }, { n, t: ctx.doc.numPages });
    prev.disabled = n === 1; next.disabled = n === ctx.doc.numPages;
    items.filter((it) => it.page === n).forEach(drawItem);
  }

  wrap.addEventListener('click', async (e) => {
    if (e.target !== wrap.querySelector('canvas')) return;
    const stamp = await getStamp(); if (!stamp) return;
    const r = wrap.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    let it;
    if (stamp.kind === 'image') {
      const fw = Math.min(0.35, stamp.widthPt ? stamp.widthPt / vw : 0.3);
      const fh = (fw * vw / stamp.ratio) / vh;
      it = { ...stamp, page: pageNo, fw, fh, fx: px - fw / 2, fy: py - fh / 2 };
    } else {
      it = { ...stamp, page: pageNo, fx: px, fy: py - (stamp.size / vh) / 2 };
    }
    items.push(it); drawItem(it); onChange(items);
  });

  function drawItem(it) {
    const box = h('div', { class: 'item' });
    const place = () => {
      Object.assign(box.style, { left: it.fx * 100 + '%', top: it.fy * 100 + '%' });
      if (it.kind === 'image') Object.assign(box.style, { width: it.fw * 100 + '%', height: it.fh * 100 + '%' });
      else { const tx = box.querySelector('.txt'); tx.style.fontSize = it.size * scale + 'px'; }
    };
    if (it.kind === 'image') box.append(h('img', { src: it.url, alt: '' }));
    else box.append(h('div', { class: 'txt', style: { color: it.color, fontWeight: it.bold ? 700 : 400, fontFamily: 'Helvetica, Arial, sans-serif' } }, it.text));
    const rm = h('button', { class: 'rm', type: 'button', 'aria-label': t({ id: 'Hapus', en: 'Remove' }), html: svg(I.x) });
    const rs = h('span', { class: 'rs' });
    box.append(rm, rs);
    rm.addEventListener('pointerdown', (e) => e.stopPropagation());
    rm.addEventListener('click', (e) => { e.stopPropagation(); items.splice(items.indexOf(it), 1); box.remove(); onChange(items); });
    // Drag to move / resize with pointer events (works for mouse, pen and touch).
    const drag = (e, mode) => {
      e.preventDefault(); e.stopPropagation();
      const r = wrap.getBoundingClientRect();
      const sx = e.clientX, sy = e.clientY, o = { ...it };
      const mv = (ev) => {
        const dx = (ev.clientX - sx) / r.width, dy = (ev.clientY - sy) / r.height;
        if (mode === 'move') { it.fx = o.fx + dx; it.fy = o.fy + dy; }
        else if (it.kind === 'image') { it.fw = Math.max(0.03, o.fw + dx); it.fh = (it.fw * vw / it.ratio) / vh; }
        else { it.size = Math.max(6, Math.min(144, o.size + dy * vh)); }
        place();
      };
      const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); onChange(items); };
      addEventListener('pointermove', mv); addEventListener('pointerup', up);
    };
    box.addEventListener('pointerdown', (e) => drag(e, 'move'));
    rs.addEventListener('pointerdown', (e) => drag(e, 'resize'));
    wrap.append(box); place();
  }

  async function apply(suffix) {
    const { StandardFonts, rgb, degrees } = await pdfLib();
    const doc = await openPdf(ctx.bytes);
    const fonts = {};
    const font = async (bold) => (fonts[bold] ||= await doc.embedFont(bold ? StandardFonts.HelveticaBold : StandardFonts.Helvetica));
    const imgCache = new Map();
    for (const it of items) {
      const page = doc.getPage(it.page - 1);
      const { width: W, height: H } = page.getSize();
      const rot = page.getRotation().angle % 360;
      const [VW, VH] = rot % 180 ? [H, W] : [W, H];
      const map = (vx, vy) => ({ 0: [vx, vy], 90: [W - vy, vx], 180: [W - vx, H - vy], 270: [vy, H - vx] }[rot] || [vx, vy]);
      if (it.kind === 'image') {
        if (!imgCache.has(it.png)) imgCache.set(it.png, await doc.embedPng(it.png));
        const w = it.fw * VW, hh = it.fh * VH;
        const [x, y] = map(it.fx * VW, VH - it.fy * VH - hh);
        page.drawImage(imgCache.get(it.png), { x, y, width: w, height: hh, rotate: degrees(rot) });
      } else {
        const f = await font(it.bold); const [r, g, b] = hexToRgb(it.color);
        winAnsiSafe(it.text).split('\n').forEach((line, i) => {
          const base = VH - it.fy * VH - it.size * (0.86 + i * 1.15);
          const [x, y] = map(it.fx * VW, base);
          page.drawText(line, { x, y, size: it.size, font: f, color: rgb(r, g, b), rotate: degrees(rot) });
        });
      }
    }
    return { name: stem(ctx.file.name) + suffix + '.pdf', data: await doc.save() };
  }

  requestAnimationFrame(() => go(1));
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => el.isConnected && go(pageNo), 200); });
  return { el, items, apply, go };
}

/** Image file → { png bytes, url, ratio }, optionally turning near-white pixels transparent. */
export async function imageStamp(file, removeWhite) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const c = h('canvas'); c.width = bmp.width; c.height = bmp.height;
  const g = c.getContext('2d'); g.drawImage(bmp, 0, 0);
  if (removeWhite) {
    const d = g.getImageData(0, 0, c.width, c.height); const p = d.data;
    for (let i = 0; i < p.length; i += 4) { const m = Math.min(p[i], p[i + 1], p[i + 2]); if (m > 225) p[i + 3] = 0; else if (m > 180) p[i + 3] = Math.round(p[i + 3] * (225 - m) / 45); }
    g.putImageData(d, 0, 0);
  }
  return canvasStamp(c);
}
export async function canvasStamp(c) {
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  return { kind: 'image', png: new Uint8Array(await blob.arrayBuffer()), url: URL.createObjectURL(blob), ratio: c.width / c.height };
}
/** Crop a canvas to its non-transparent pixels. */
export function trim(c) {
  const g = c.getContext('2d'); const { data, width, height } = g.getImageData(0, 0, c.width, c.height);
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (data[(y * width + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return null;
  const pad = 6; x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(width - 1, x1 + pad); y1 = Math.min(height - 1, y1 + pad);
  const o = h('canvas'); o.width = x1 - x0 + 1; o.height = y1 - y0 + 1;
  o.getContext('2d').drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height);
  return o;
}
