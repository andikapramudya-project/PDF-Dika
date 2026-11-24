import { h, t, stem, parseRanges, UserError, reportError } from '../core.js';
import { shell, pageGrid } from '../ui.js';
import { singlePdf, buildFrom } from './_single.js';

export async function mount(root, tool) {
  let ctx;
  const count = h('p', { class: 'note' });
  const ui = shell(root, {
    actionLabel: t({ id: 'Hapus halaman terpilih', en: 'Delete selected pages' }),
    panelTitle: t({ id: 'Halaman yang dihapus', en: 'Pages to delete' }),
    run: async () => {
      const keep = ctx.pages.filter((p) => !p.selected);
      if (!keep.length) throw new UserError(t({ id: 'Sisakan minimal satu halaman.', en: 'Keep at least one page.' }));
      const out = await buildFrom(ctx.bytes, keep);
      return { files: [{ name: stem(ctx.file.name) + '-dipangkas.pdf', data: await out.save() }],
        summary: t({ id: '{d} halaman dihapus, {k} tersisa.', en: '{d} pages deleted, {k} left.' }, { d: ctx.pages.length - keep.length, k: keep.length }) };
    },
  });
  singlePdf(ui, tool, (c) => {
    ctx = c;
    const grid = pageGrid({ pages: c.pages, mode: 'select', selectStyle: 'del', onChange: sync });
    const rng = h('input', { type: 'text', placeholder: '2, 5-7', inputmode: 'numeric' });
    ui.opts.append(
      h('p', { class: 'note' }, t({ id: 'Klik halaman yang mau dibuang, atau tulis nomornya.', en: 'Click the pages to remove, or type their numbers.' })),
      h('div', { class: 'field' }, h('label', null, t({ id: 'Nomor halaman', en: 'Page numbers' })),
        h('div', { class: 'row' }, rng, h('button', { class: 'btn small', type: 'button', style: { flex: 'none' }, onclick: () => {
          try { const s = new Set(parseRanges(rng.value, c.pages.length).flat()); c.pages.forEach((p, i) => (p.selected = s.has(i + 1))); grid.render(); sync(); }
          catch (e) { reportError(e); }
        } }, t({ id: 'Pilih', en: 'Select' })))),
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
