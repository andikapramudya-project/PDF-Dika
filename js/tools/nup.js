import { h, t, stem, pdfLib, openPdf } from '../core.js';
import { shell, pageGrid, field, seg } from '../ui.js';
import { singlePdf } from './_single.js';

export async function mount(root, tool) {
  let ctx, per = 2, paper = 'a4', border = false;
  const ui = shell(root, {
    actionLabel: t({ id: 'Buat lembar cetak', en: 'Make print sheets' }),
    panelTitle: t({ id: 'Tata letak', en: 'Layout' }),
    run: async () => {
      const { PDFDocument, rgb } = await pdfLib();
      const src = await openPdf(ctx.bytes);
      const out = await PDFDocument.create();
      const embedded = await out.embedPages(src.getPages());
      const [cols, rows] = per === 2 ? [2, 1] : per === 4 ? [2, 2] : [3, 2];
      const base = paper === 'a4' ? [595.28, 841.89] : [612, 792];
      const [W, H] = cols > rows ? [base[1], base[0]] : base; // landscape for 2 and 6
      const m = 18, gap = 10;
      const cw = (W - 2 * m - (cols - 1) * gap) / cols, ch = (H - 2 * m - (rows - 1) * gap) / rows;
      for (let i = 0; i < embedded.length; i += per) {
        const sheet = out.addPage([W, H]);
        for (let k = 0; k < per && i + k < embedded.length; k++) {
          const ep = embedded[i + k];
          const c = k % cols, r = Math.floor(k / cols);
          const s = Math.min(cw / ep.width, ch / ep.height);
          const w = ep.width * s, hh = ep.height * s;
          const x = m + c * (cw + gap) + (cw - w) / 2;
          const y = H - m - (r + 1) * ch - r * gap + (ch - hh) / 2;
          sheet.drawPage(ep, { x, y, width: w, height: hh });
          if (border) sheet.drawRectangle({ x, y, width: w, height: hh, borderColor: rgb(.6, .6, .6), borderWidth: .6 });
        }
      }
      return { files: [{ name: `${stem(ctx.file.name)}-${per}up.pdf`, data: await out.save() }],
        summary: t({ id: '{p} halaman jadi {s} lembar.', en: '{p} pages on {s} sheets.' }, { p: embedded.length, s: out.getPageCount() }) };
    },
  });
  singlePdf(ui, tool, (c) => {
    ctx = c;
    ui.opts.append(
      field(t({ id: 'Halaman per lembar', en: 'Pages per sheet' }), seg([[2, '2'], [4, '4'], [6, '6']], per, (v) => (per = v))),
      field(t({ id: 'Ukuran kertas', en: 'Paper size' }), seg([['a4', 'A4'], ['letter', 'Letter']], paper, (v) => (paper = v))),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', onchange: (e) => (border = e.target.checked) }), t({ id: 'Beri garis tepi', en: 'Draw borders' })));
    ui.stage.append(pageGrid({ pages: c.pages, mode: 'view' }).el);
    ui.setReady(true);
  });
}
