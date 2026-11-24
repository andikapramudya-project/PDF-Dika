import { h, t, stem } from '../core.js';
import { shell, pageGrid } from '../ui.js';
import { singlePdf, buildFrom } from './_single.js';

export async function mount(root, tool) {
  let ctx;
  const ui = shell(root, {
    actionLabel: t({ id: 'Balik urutan', en: 'Reverse order' }),
    run: async () => {
      const out = await buildFrom(ctx.bytes, [...ctx.pages].reverse());
      return { files: [{ name: stem(ctx.file.name) + '-terbalik.pdf', data: await out.save() }], summary: t({ id: 'Halaman terakhir sekarang jadi halaman pertama.', en: 'The last page is now the first.' }) };
    },
  });
  singlePdf(ui, tool, (c) => {
    ctx = c;
    ui.opts.append(h('p', { class: 'note' }, t({ id: 'Pratinjau di samping menunjukkan urutan setelah dibalik.', en: 'The preview shows the order after reversing.' })));
    ui.stage.append(pageGrid({ pages: [...c.pages].reverse(), mode: 'view' }).el);
    ui.setReady(c.pages.length > 1);
  });
}
