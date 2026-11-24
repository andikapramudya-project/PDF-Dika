import { h, t, stem, pdfLib, openPdf, hexToRgb, winAnsiSafe } from '../core.js';
import { shell, field, seg, range, pageGrid } from '../ui.js';
import { singlePdf } from './_single.js';

/** Draw one line of text at a position on the page as it is seen (rotation aware). v: 't'|'b', align: 'l'|'c'|'r'. */
function drawLine(page, font, text, size, color, v, align, margin) {
  const { width: W, height: H } = page.getSize();
  const rot = ((page.getRotation().angle % 360) + 360) % 360;
  const [VW, VH] = rot % 180 ? [H, W] : [W, H];
  const tw = font.widthOfTextAtSize(text, size);
  const vx = align === 'l' ? margin : align === 'r' ? VW - margin - tw : (VW - tw) / 2;
  const vy = v === 't' ? VH - margin - size * 0.8 : margin;
  const at = { 0: [vx, vy], 90: [W - vy, vx], 180: [W - vx, H - vy], 270: [vy, H - vx] }[rot];
  page.drawText(text, { x: at[0], y: at[1], size, font, color, rotate: { type: 'degrees', angle: rot } });
}

export async function mount(root, tool) {
  let ctx;
  const o = { head: '', foot: t({ id: 'Halaman {n} dari {total}', en: 'Page {n} of {total}' }), align: 'c', size: 10, margin: 24, color: '#3A4160', skipFirst: false, font: 'helv' };
  const ui = shell(root, {
    actionLabel: t({ id: 'Tambahkan header & footer', en: 'Add header & footer' }),
    panelTitle: t({ id: 'Isi header & footer', en: 'Header & footer text' }),
    run: async () => {
      const { StandardFonts, rgb } = await pdfLib();
      const doc = await openPdf(ctx.bytes);
      const font = await doc.embedFont(o.font === 'times' ? StandardFonts.TimesRoman : StandardFonts.Helvetica);
      const [r, g, b] = hexToRgb(o.color); const color = rgb(r, g, b);
      const pages = doc.getPages(); const total = pages.length;
      const date = new Date().toLocaleDateString(t({ id: 'id-ID', en: 'en-GB' }), { day: 'numeric', month: 'long', year: 'numeric' });
      const fill = (s, n) => winAnsiSafe(s.replace(/\{n\}/g, n).replace(/\{total\}/g, total).replace(/\{file\}/g, stem(ctx.file.name)).replace(/\{date\}/g, date));
      let n = 0;
      pages.forEach((page, i) => {
        if (o.skipFirst && i === 0) return;
        if (o.head.trim()) drawLine(page, font, fill(o.head, i + 1), o.size, color, 't', o.align, o.margin);
        if (o.foot.trim()) drawLine(page, font, fill(o.foot, i + 1), o.size, color, 'b', o.align, o.margin);
        n++;
      });
      return { files: [{ name: stem(ctx.file.name) + '-header.pdf', data: await doc.save() }], summary: t({ id: 'Header dan footer ditambahkan ke {n} halaman.', en: 'Header and footer added to {n} pages.' }, { n }) };
    },
  });
  singlePdf(ui, tool, (c) => {
    ctx = c;
    const txt = (key, ph) => h('input', { type: 'text', value: o[key], placeholder: ph, oninput: (e) => (o[key] = e.target.value) });
    ui.opts.append(
      field(t({ id: 'Header (atas)', en: 'Header (top)' }), txt('head', t({ id: 'mis. Laporan Tahunan 2026', en: 'e.g. Annual Report 2026' }))),
      field(t({ id: 'Footer (bawah)', en: 'Footer (bottom)' }), txt('foot', '')),
      h('p', { class: 'note' }, t({ id: 'Kode yang bisa dipakai: {n} nomor halaman, {total} jumlah halaman, {file} nama file, {date} tanggal hari ini.', en: 'You can use: {n} page number, {total} page count, {file} file name, {date} today’s date.' })),
      field(t({ id: 'Rata', en: 'Alignment' }), seg([['l', t({ id: 'Kiri', en: 'Left' })], ['c', t({ id: 'Tengah', en: 'Center' })], ['r', t({ id: 'Kanan', en: 'Right' })]], o.align, (v) => (o.align = v))),
      field(t({ id: 'Huruf', en: 'Font' }), seg([['helv', 'Sans'], ['times', 'Serif']], o.font, (v) => (o.font = v))),
      field(t({ id: 'Ukuran huruf', en: 'Font size' }), range(7, 20, 1, o.size, (v) => (o.size = v), (v) => v + 'pt')),
      field(t({ id: 'Jarak dari tepi', en: 'Distance from edge' }), range(10, 60, 2, o.margin, (v) => (o.margin = v), (v) => v + 'pt')),
      field(t({ id: 'Warna', en: 'Colour' }), h('input', { type: 'color', value: o.color, oninput: (e) => (o.color = e.target.value) })),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', onchange: (e) => (o.skipFirst = e.target.checked) }), t({ id: 'Lewati halaman pertama (sampul)', en: 'Skip the first page (cover)' })));
    ui.stage.append(pageGrid({ pages: c.pages, mode: 'view' }).el);
    ui.setReady(true);
  });
}
