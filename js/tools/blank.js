import { h, t, stem, pdfLib, openPdf } from '../core.js';
import { shell, pageGrid, field } from '../ui.js';
import { singlePdf } from './_single.js';

export async function mount(root, tool) {
  let ctx;
  const where = h('select', null,
    h('option', { value: 'end' }, t({ id: 'Di akhir dokumen', en: 'At the end' })),
    h('option', { value: 'start' }, t({ id: 'Di awal dokumen', en: 'At the start' })),
    h('option', { value: 'after' }, t({ id: 'Setelah halaman tertentu', en: 'After a specific page' })),
    h('option', { value: 'every' }, t({ id: 'Setelah setiap halaman', en: 'After every page' })));
  const after = h('input', { type: 'number', min: 1, value: 1 });
  const howMany = h('input', { type: 'number', min: 1, max: 50, value: 1 });
  const afterField = field(t({ id: 'Nomor halaman', en: 'Page number' }), after);
  const ui = shell(root, {
    actionLabel: t({ id: 'Sisipkan halaman', en: 'Insert pages' }),
    panelTitle: t({ id: 'Posisi', en: 'Position' }),
    run: async () => {
      const { PDFDocument } = await pdfLib();
      const doc = await openPdf(ctx.bytes);
      const n = doc.getPageCount(); const k = Math.max(1, Math.min(50, +howMany.value || 1));
      const sizeAt = (i) => doc.getPage(Math.min(Math.max(i, 0), n - 1)).getSize();
      const ins = (idx, ref) => { const { width, height } = sizeAt(ref); for (let j = 0; j < k; j++) doc.insertPage(idx, [width, height]); };
      const w = where.value;
      if (w === 'end') ins(n, n - 1);
      else if (w === 'start') ins(0, 0);
      else if (w === 'after') { const a = Math.min(Math.max(1, +after.value || 1), n); ins(a, a - 1); }
      else for (let i = n - 1; i >= 0; i--) ins(i + 1, i);
      const added = doc.getPageCount() - n;
      return { files: [{ name: stem(ctx.file.name) + '-kosong.pdf', data: await doc.save() }],
        summary: t({ id: '{n} halaman kosong disisipkan.', en: '{n} blank pages inserted.' }, { n: added }) };
    },
  });
  singlePdf(ui, tool, (c) => {
    ctx = c; after.max = c.pages.length;
    const sync = () => (afterField.hidden = where.value !== 'after');
    where.addEventListener('change', sync); sync();
    ui.opts.append(field(t({ id: 'Letakkan', en: 'Place' }), where), afterField, field(t({ id: 'Jumlah halaman kosong', en: 'Number of blank pages' }), howMany),
      h('p', { class: 'note' }, t({ id: 'Ukuran halaman kosong mengikuti halaman di sebelahnya.', en: 'Blank pages match the size of the neighbouring page.' })));
    ui.stage.append(pageGrid({ pages: c.pages, mode: 'view' }).el);
    ui.setReady(true);
  });
}
