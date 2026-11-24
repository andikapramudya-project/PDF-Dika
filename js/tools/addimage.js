import { h, t, svg, I, UserError, reportError } from '../core.js';
import { shell } from '../ui.js';
import { singlePdf } from './_single.js';
import { placer, imageStamp } from './_placer.js';

export async function mount(root, tool) {
  let pl, stamp = null;
  const ui = shell(root, {
    actionLabel: t({ id: 'Simpan PDF', en: 'Save PDF' }),
    panelTitle: t({ id: 'Gambar', en: 'Image' }),
    run: async () => {
      if (!pl.items.length) throw new UserError(t({ id: 'Klik di halaman untuk menaruh gambar dulu.', en: 'Click on the page to place the image first.' }));
      return { files: [await pl.apply('-gambar')], summary: t({ id: '{n} gambar ditempatkan.', en: '{n} image(s) placed.' }, { n: pl.items.length }) };
    },
  });
  singlePdf(ui, tool, (ctx) => {
    const prev = h('div', { class: 'sig-preview' });
    const rmw = h('input', { type: 'checkbox' });
    const inp = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', class: 'sr', onchange: async () => {
      if (!inp.files[0]) return; stamp = await imageStamp(inp.files[0], rmw.checked); inp.value = '';
      prev.replaceChildren(h('button', { type: 'button' }, h('img', { src: stamp.url, alt: '' })));
    } });
    ui.opts.append(h('button', { class: 'btn', type: 'button', onclick: () => inp.click() }, h('span', { html: svg(I.upload), style: { width: '18px', display: 'inline-flex' } }), t({ id: 'Pilih gambar', en: 'Choose image' })), inp,
      h('label', { class: 'check' }, rmw, t({ id: 'Hilangkan latar putih', en: 'Remove white background' })), prev,
      h('p', { class: 'note' }, t({ id: 'Setelah memilih gambar, klik di halaman untuk menaruhnya.', en: 'After choosing an image, click on the page to place it.' })));
    pl = placer(ctx, { getStamp: () => { if (!stamp) { reportError(new UserError(t({ id: 'Pilih gambar di panel dulu.', en: 'Choose an image in the panel first.' }))); return null; } return { ...stamp, widthPt: 150 }; } });
    ui.stage.append(pl.el); ui.setReady(true);
  });
}
