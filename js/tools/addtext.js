import { h, t, UserError, reportError } from '../core.js';
import { shell, field, range } from '../ui.js';
import { singlePdf } from './_single.js';
import { placer } from './_placer.js';

export async function mount(root, tool) {
  let pl; const o = { text: '', size: 14, color: '#141A33', bold: false };
  const ui = shell(root, {
    actionLabel: t({ id: 'Simpan PDF', en: 'Save PDF' }),
    panelTitle: t({ id: 'Teks', en: 'Text' }),
    run: async () => {
      if (!pl.items.length) throw new UserError(t({ id: 'Klik di halaman untuk menaruh teks dulu.', en: 'Click on the page to add text first.' }));
      return { files: [await pl.apply('-teks')], summary: t({ id: '{n} teks ditambahkan.', en: '{n} text item(s) added.' }, { n: pl.items.length }) };
    },
  });
  singlePdf(ui, tool, (ctx) => {
    const ta = h('textarea', { rows: 3, placeholder: t({ id: 'Tulis teks di sini', en: 'Write your text here' }), oninput: () => (o.text = ta.value) });
    ui.opts.append(field(t({ id: 'Teks yang ditambahkan', en: 'Text to add' }), ta),
      field(t({ id: 'Ukuran huruf', en: 'Font size' }), range(6, 72, 1, o.size, (v) => (o.size = v), (v) => v + 'pt')),
      h('div', { class: 'row' }, field(t({ id: 'Warna', en: 'Colour' }), h('input', { type: 'color', value: o.color, oninput: (e) => (o.color = e.target.value) })),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', onchange: (e) => (o.bold = e.target.checked) }), t({ id: 'Tebal', en: 'Bold' }))),
      h('p', { class: 'note' }, t({ id: 'Tulis teks, lalu klik di halaman. Tarik sudut biru ke bawah untuk memperbesar.', en: 'Write the text, then click on the page. Pull the blue corner down to enlarge.' })));
    pl = placer(ctx, { getStamp: () => {
      if (!o.text.trim()) { reportError(new UserError(t({ id: 'Tulis teks di panel dulu.', en: 'Write the text in the panel first.' }))); ta.focus(); return null; }
      return { kind: 'text', ...o };
    } });
    ui.stage.append(pl.el); ui.setReady(true);
  });
}
