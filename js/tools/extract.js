import { h, t, stem, parseRanges, reportError, JSZip } from '../core.js';
import { shell, pageGrid, seg, field } from '../ui.js';
import { singlePdf, buildFrom } from './_single.js';

export async function mount(root, tool) {
  let ctx, mode = 'one';
  const count = h('p', { class: 'note' });
  const ui = shell(root, {
    actionLabel: t({ id: 'Ambil halaman', en: 'Extract pages' }),
    panelTitle: t({ id: 'Halaman yang diambil', en: 'Pages to extract' }),
    run: async () => {
      const sel = ctx.pages.map((p, i) => ({ ...p, n: i + 1 })).filter((p) => p.selected);
      const base = stem(ctx.file.name);
      if (mode === 'one') {
        const out = await buildFrom(ctx.bytes, sel);
        return { files: [{ name: base + '-halaman.pdf', data: await out.save() }], summary: t({ id: '{n} halaman disimpan sebagai PDF baru.', en: '{n} pages saved as a new PDF.' }, { n: sel.length }) };
      }
      const Zip = await JSZip(); const zip = new Zip();
      for (const p of sel) zip.file(`${base}-hal-${p.n}.pdf`, await (await buildFrom(ctx.bytes, [p])).save());
      return { files: [{ name: base + '-halaman.zip', data: await zip.generateAsync({ type: 'uint8array' }), type: 'application/zip' }],
        summary: t({ id: '{n} PDF terpisah dalam satu ZIP.', en: '{n} separate PDFs in one ZIP.' }, { n: sel.length }) };
    },
  });
  singlePdf(ui, tool, (c) => {
    ctx = c;
    const grid = pageGrid({ pages: c.pages, mode: 'select', onChange: sync });
    const rng = h('input', { type: 'text', placeholder: '1-3, 8', inputmode: 'numeric' });
    ui.opts.append(
      h('div', { class: 'field' }, h('label', null, t({ id: 'Nomor halaman', en: 'Page numbers' })),
        h('div', { class: 'row' }, rng, h('button', { class: 'btn small', type: 'button', style: { flex: 'none' }, onclick: () => {
          try { const s = new Set(parseRanges(rng.value, c.pages.length).flat()); c.pages.forEach((p, i) => (p.selected = s.has(i + 1))); grid.render(); sync(); } catch (e) { reportError(e); }
        } }, t({ id: 'Pilih', en: 'Select' })))),
      h('div', { class: 'row' },
        h('button', { class: 'btn small', type: 'button', onclick: () => { c.pages.forEach((p) => (p.selected = true)); grid.render(); sync(); } }, t({ id: 'Pilih semua', en: 'Select all' })),
        h('button', { class: 'btn small', type: 'button', onclick: () => { c.pages.forEach((p) => (p.selected = false)); grid.render(); sync(); } }, t({ id: 'Kosongkan', en: 'Clear' }))),
      field(t({ id: 'Hasil', en: 'Output' }), seg([['one', t({ id: 'Satu PDF', en: 'One PDF' })], ['each', t({ id: 'PDF per halaman', en: 'PDF per page' })]], mode, (v) => (mode = v))),
      count);
    ui.stage.append(grid.el);
    function sync() {
      const n = c.pages.filter((p) => p.selected).length;
      count.textContent = t({ id: '{n} dari {t} halaman dipilih.', en: '{n} of {t} pages selected.' }, { n, t: c.pages.length });
      ui.setReady(n > 0);
    }
    sync();
  });
}
