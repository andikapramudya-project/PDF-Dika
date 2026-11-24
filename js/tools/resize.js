import { h, t, stem, pdfLib, openPdf } from '../core.js';
import { shell, field, seg, range, pageGrid } from '../ui.js';
import { singlePdf } from './_single.js';

const MM = 72 / 25.4;
const SIZES = {
  a4: ['A4', 210, 297], f4: ['F4 / Folio', 215, 330], letter: ['Letter', 215.9, 279.4], legal: ['Legal', 215.9, 355.6], a5: ['A5', 148, 210], a3: ['A3', 297, 420],
};

/** Draw an embedded page so it looks the way it does in a viewer (rotation applied) inside box bx,by,bw,bh. */
export function drawFitted(target, emb, rot, bx, by, bw, bh) {
  const [vw, vh] = rot % 180 ? [emb.height, emb.width] : [emb.width, emb.height];
  const s = Math.min(bw / vw, bh / vh);
  const x0 = bx + (bw - vw * s) / 2, y0 = by + (bh - vh * s) / 2;
  const w = emb.width * s, hh = emb.height * s;
  const at = { 0: [x0, y0], 90: [x0, y0 + w], 180: [x0 + w, y0 + hh], 270: [x0 + hh, y0] }[rot];
  target.drawPage(emb, { x: at[0], y: at[1], xScale: s, yScale: s, rotate: { type: 'degrees', angle: -rot } });
}

export async function mount(root, tool) {
  let ctx, size = 'a4', orient = 'auto', margin = 0;
  const ui = shell(root, {
    actionLabel: t({ id: 'Ubah ukuran', en: 'Resize pages' }),
    panelTitle: t({ id: 'Ukuran baru', en: 'New size' }),
    run: async () => {
      const { PDFDocument } = await pdfLib();
      const src = await openPdf(ctx.bytes);
      const out = await PDFDocument.create();
      const [, mw, mh] = SIZES[size];
      for (const p of src.getPages()) {
        const crop = p.getCropBox();
        const emb = await out.embedPage(p, { left: crop.x, bottom: crop.y, right: crop.x + crop.width, top: crop.y + crop.height });
        const rot = ((p.getRotation().angle % 360) + 360) % 360;
        const land = orient === 'land' || (orient === 'auto' && (rot % 180 ? crop.height > crop.width : crop.width > crop.height));
        const [W, H] = land ? [mh * MM, mw * MM] : [mw * MM, mh * MM];
        const page = out.addPage([W, H]);
        const m = margin * MM;
        drawFitted(page, emb, rot, m, m, W - 2 * m, H - 2 * m);
      }
      return { files: [{ name: `${stem(ctx.file.name)}-${size}.pdf`, data: await out.save() }],
        summary: t({ id: '{n} halaman sekarang berukuran {s}.', en: '{n} pages are now {s}.' }, { n: out.getPageCount(), s: SIZES[size][0] }) };
    },
  });
  singlePdf(ui, tool, (c) => {
    ctx = c;
    const sel = h('select', { onchange: (e) => (size = e.target.value) }, Object.entries(SIZES).map(([k, [n, w, hh]]) => h('option', { value: k, selected: k === size }, `${n} (${w} × ${hh} mm)`)));
    ui.opts.append(
      field(t({ id: 'Ukuran kertas', en: 'Paper size' }), sel),
      field(t({ id: 'Orientasi', en: 'Orientation' }), seg([['auto', t({ id: 'Ikuti halaman', en: 'Match page' })], ['port', t({ id: 'Tegak', en: 'Portrait' })], ['land', t({ id: 'Mendatar', en: 'Landscape' })]], orient, (v) => (orient = v))),
      field(t({ id: 'Margin', en: 'Margin' }), range(0, 25, 1, margin, (v) => (margin = v), (v) => v + ' mm')),
      h('p', { class: 'note' }, t({ id: 'Isi halaman diperbesar atau diperkecil agar pas, tanpa terpotong dan tanpa mengubah perbandingannya.', en: 'Content is scaled to fit, never cut off and never stretched.' })));
    ui.stage.append(pageGrid({ pages: c.pages, mode: 'view' }).el);
    ui.setReady(true);
  });
}
