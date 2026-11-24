import { h, t, stem, svg, I } from '../core.js';
import { shell, pageGrid } from '../ui.js';
import { singlePdf, buildFrom } from './_single.js';

export async function mount(root, tool) {
  let ctx;
  const ui = shell(root, {
    actionLabel: t({ id: 'Simpan PDF terputar', en: 'Save rotated PDF' }),
    panelTitle: t({ id: 'Putar', en: 'Rotate' }),
    run: async () => {
      const out = await buildFrom(ctx.bytes, ctx.pages);
      const n = ctx.pages.filter((p) => p.rotation).length;
      return { files: [{ name: stem(ctx.file.name) + '-diputar.pdf', data: await out.save() }],
        summary: t({ id: '{n} halaman diputar.', en: '{n} pages rotated.' }, { n }) };
    },
  });
  singlePdf(ui, tool, (c) => {
    ctx = c;
    const grid = pageGrid({ pages: c.pages, mode: 'rotate', onChange: sync });
    const all = (d) => { c.pages.forEach((p) => (p.rotation = (p.rotation + d + 360) % 360)); grid.render(); sync(); };
    ui.opts.append(
      h('p', { class: 'note' }, t({ id: 'Klik halaman untuk memutarnya 90°, atau putar semua sekaligus.', en: 'Click a page to turn it 90°, or rotate them all at once.' })),
      h('div', { class: 'row' },
        h('button', { class: 'btn', type: 'button', onclick: () => all(-90) }, h('span', { html: svg(I.rotL), style: { width: '18px', display: 'inline-flex' } }), t({ id: 'Semua kiri', en: 'All left' })),
        h('button', { class: 'btn', type: 'button', onclick: () => all(90) }, h('span', { html: svg(I.rotR), style: { width: '18px', display: 'inline-flex' } }), t({ id: 'Semua kanan', en: 'All right' }))),
      h('button', { class: 'btn small', type: 'button', onclick: () => { c.pages.forEach((p) => (p.rotation = 0)); grid.render(); sync(); } }, t({ id: 'Kembalikan semua', en: 'Reset all' })));
    ui.stage.append(grid.el);
    function sync() { ui.setReady(c.pages.some((p) => p.rotation)); }
    sync();
  });
}
