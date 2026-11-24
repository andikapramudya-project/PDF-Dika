import { h, t, stem, parseRanges, JSZip, UserError } from '../core.js';
import { shell, pageGrid, seg, field } from '../ui.js';
import { singlePdf, buildFrom } from './_single.js';

export async function mount(root, tool) {
  let ctx, mode = 'each', every = 2;
  const rng = h('input', { type: 'text', placeholder: '1-3, 4-8, 9-', inputmode: 'numeric' });
  const nIn = h('input', { type: 'number', min: 1, value: every, oninput: () => (every = Math.max(1, +nIn.value || 1)) });
  const ui = shell(root, {
    actionLabel: t({ id: 'Pisahkan PDF', en: 'Split PDF' }),
    panelTitle: t({ id: 'Cara memisah', en: 'How to split' }),
    run: async () => {
      const n = ctx.pages.length; let groups;
      if (mode === 'each') groups = ctx.pages.map((_, i) => [i + 1]);
      else if (mode === 'every') { groups = []; for (let i = 1; i <= n; i += every) groups.push(Array.from({ length: Math.min(every, n - i + 1) }, (_, k) => i + k)); }
      else groups = parseRanges(rng.value, n);
      if (groups.length < 2 && mode !== 'ranges') throw new UserError(t({ id: 'Hasilnya cuma satu file. Pilih jumlah halaman yang lebih kecil.', en: 'That gives only one file. Pick a smaller page count.' }));
      const base = stem(ctx.file.name);
      const files = [];
      for (const g of groups) {
        const out = await buildFrom(ctx.bytes, g.map((i) => ctx.pages[i - 1]));
        const label = g.length === 1 ? g[0] : `${g[0]}-${g[g.length - 1]}`;
        files.push({ name: `${base}-${label}.pdf`, data: await out.save() });
      }
      const Zip = await JSZip(); const zip = new Zip();
      files.forEach((f) => zip.file(f.name, f.data));
      const zipped = { name: base + '-terpisah.zip', data: await zip.generateAsync({ type: 'uint8array' }), type: 'application/zip' };
      return { files: files.length > 1 ? [zipped, ...files] : files,
        summary: t({ id: 'Dipisah menjadi {n} file. Unduh ZIP atau ambil satu per satu.', en: 'Split into {n} files. Download the ZIP or pick them one by one.' }, { n: files.length }) };
    },
  });
  singlePdf(ui, tool, (c) => {
    ctx = c;
    const extra = h('div');
    const draw = () => extra.replaceChildren(
      mode === 'ranges' ? field(t({ id: 'Rentang halaman', en: 'Page ranges' }), rng, t({ id: 'Setiap rentang jadi satu file. Contoh: 1-3, 4-8, 9-', en: 'Each range becomes one file. Example: 1-3, 4-8, 9-' })) :
      mode === 'every' ? field(t({ id: 'Halaman per file', en: 'Pages per file' }), nIn) :
      h('p', { class: 'note' }, t({ id: 'Setiap halaman disimpan sebagai PDF sendiri ({n} file).', en: 'Each page is saved as its own PDF ({n} files).' }, { n: c.pages.length })));
    ui.opts.append(seg([['each', t({ id: 'Per halaman', en: 'Every page' })], ['ranges', t({ id: 'Per rentang', en: 'By range' })], ['every', t({ id: 'Setiap N', en: 'Every N' })]], mode, (v) => { mode = v; draw(); }), extra);
    draw();
    ui.stage.append(pageGrid({ pages: c.pages, mode: 'view' }).el);
    ui.setReady(true);
  });
}
