import { h, t, stem, pdfLib, openPdf, hexToRgb, winAnsiSafe } from '../core.js';
import { shell, field, seg, posGrid, range, pageGrid } from '../ui.js';
import { singlePdf } from './_single.js';

export async function mount(root, tool) {
  let ctx;
  const o = { pos: 'bc', fmt: 'n', start: 1, from: 1, size: 11, margin: 28, color: '#141A33' };
  const ui = shell(root, {
    actionLabel: t({ id: 'Tambahkan nomor', en: 'Add numbers' }),
    panelTitle: t({ id: 'Penomoran', en: 'Numbering' }),
    run: async () => {
      const { StandardFonts, rgb } = await pdfLib();
      const doc = await openPdf(ctx.bytes);
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const pages = doc.getPages(); const total = pages.length - (o.from - 1);
      const [r, g, b] = hexToRgb(o.color);
      pages.forEach((page, i) => {
        if (i + 1 < o.from) return;
        const n = o.start + (i + 1 - o.from);
        const label = winAnsiSafe(o.fmt === 'n' ? `${n}` : o.fmt === 'of' ? t({ id: 'Halaman {n} dari {t}', en: 'Page {n} of {t}' }, { n, t: total + o.start - 1 }) : o.fmt === 'dash' ? `- ${n} -` : `${n} / ${total + o.start - 1}`);
        const { width: W, height: H } = page.getSize();
        const rot = page.getRotation().angle % 360;
        // Work in "visual" coordinates, then map back to the unrotated page space.
        const [VW, VH] = rot % 180 ? [H, W] : [W, H];
        const tw = font.widthOfTextAtSize(label, o.size);
        const v = o.pos[0], hz = o.pos[1];
        const vx = hz === 'l' ? o.margin : hz === 'r' ? VW - o.margin - tw : (VW - tw) / 2;
        const vy = v === 't' ? VH - o.margin - o.size : v === 'b' ? o.margin : (VH - o.size) / 2;
        const map = { 0: [vx, vy], 90: [W - vy, vx], 180: [W - vx, H - vy], 270: [vy, H - vx] }[rot] || [vx, vy];
        page.drawText(label, { x: map[0], y: map[1], size: o.size, font, color: rgb(r, g, b), rotate: { type: 'degrees', angle: rot } });
      });
      return { files: [{ name: stem(ctx.file.name) + '-bernomor.pdf', data: await doc.save() }], summary: t({ id: 'Nomor ditambahkan ke {n} halaman.', en: 'Numbers added to {n} pages.' }, { n: total }) };
    },
  });
  singlePdf(ui, tool, (c) => {
    ctx = c;
    const num = (key, min) => { const i = h('input', { type: 'number', min, value: o[key], oninput: () => (o[key] = Math.max(min, +i.value || min)) }); return i; };
    const fromIn = num('from', 1); fromIn.max = c.pages.length;
    ui.opts.append(
      field(t({ id: 'Letak', en: 'Position' }), posGrid(o.pos, (v) => (o.pos = v))),
      field(t({ id: 'Format', en: 'Format' }), seg([['n', '1'], ['dash', '- 1 -'], ['slash', '1 / N'], ['of', t({ id: 'Halaman 1 dari N', en: 'Page 1 of N' })]], o.fmt, (v) => (o.fmt = v))),
      h('div', { class: 'row' }, field(t({ id: 'Mulai dari angka', en: 'First number' }), num('start', 0)), field(t({ id: 'Mulai di halaman', en: 'Start on page' }), fromIn)),
      field(t({ id: 'Ukuran huruf', en: 'Font size' }), range(7, 28, 1, o.size, (v) => (o.size = v), (v) => v + 'pt')),
      field(t({ id: 'Jarak dari tepi', en: 'Distance from edge' }), range(10, 72, 2, o.margin, (v) => (o.margin = v), (v) => v + 'pt')),
      field(t({ id: 'Warna', en: 'Colour' }), h('input', { type: 'color', value: o.color, oninput: (e) => (o.color = e.target.value) })));
    ui.stage.append(pageGrid({ pages: c.pages, mode: 'view' }).el);
    ui.setReady(true);
  });
}
