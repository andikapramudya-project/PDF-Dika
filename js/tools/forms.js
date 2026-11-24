import { h, t, stem, pdfLib, openPdf } from '../core.js';
import { shell, field } from '../ui.js';
import { singlePdf } from './_single.js';
import { flattenForm } from './flatten.js';

const pretty = (name) => name.split('.').pop().replace(/[_]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\[\d+\]$/, '').trim() || name;

export async function mount(root, tool) {
  let ctx, doc, lib, flat = false;
  const values = new Map(); // field name -> value
  const ui = shell(root, {
    actionLabel: t({ id: 'Simpan formulir', en: 'Save form' }),
    panelTitle: t({ id: 'Simpan', en: 'Save' }),
    run: async () => {
      const out = await openPdf(ctx.bytes);
      const form = out.getForm();
      let filled = 0;
      for (const f of form.getFields()) {
        if (!values.has(f.getName())) continue;
        const v = values.get(f.getName());
        try {
          if (f instanceof lib.PDFTextField) f.setText(v || undefined);
          else if (f instanceof lib.PDFCheckBox) v ? f.check() : f.uncheck();
          else if (f instanceof lib.PDFRadioGroup) { if (v) f.select(v); else f.clear(); }
          else if (f instanceof lib.PDFDropdown) { if (v) f.select(v); else f.clear(); }
          else if (f instanceof lib.PDFOptionList) { if (v.length) f.select(v); else f.clear(); }
          filled++;
        } catch (e) { console.warn('field skipped', f.getName(), e); }
      }
      try { form.updateFieldAppearances(); } catch (e) { console.warn(e); }
      if (flat) flattenForm(out);
      return { files: [{ name: stem(ctx.file.name) + '-terisi.pdf', data: await out.save() }],
        summary: t({ id: '{n} kolom tersimpan.', en: '{n} fields saved.' }, { n: filled }) + (flat ? ' ' + t({ id: 'Formulir sudah diratakan.', en: 'The form is flattened.' }) : '') };
    },
  });

  singlePdf(ui, tool, async (c) => {
    ctx = c; lib = await pdfLib(); values.clear();
    doc = await openPdf(c.bytes);
    const form = doc.getForm();
    const pageIndex = new Map(doc.getPages().map((p, i) => [p.ref.toString(), i + 1]));
    const pageOf = (f) => { const w = f.acroField.getWidgets()[0]; const r = w?.P?.(); return (r && pageIndex.get(r.toString())) || 0; };
    const fields = form.getFields().filter((f) => !(f instanceof lib.PDFButton) && !(f instanceof lib.PDFSignature)).map((f) => ({ f, page: pageOf(f) }));
    if (!fields.length) {
      ui.stage.append(h('section', { class: 'result' }, h('h2', null, t({ id: 'Tidak ada kolom formulir', en: 'No form fields' })),
        h('p', null, t({ id: 'PDF ini tidak punya kolom yang bisa diisi. Untuk menulis di atas halaman, pakai alat Tambah teks.', en: 'This PDF has no fillable fields. To write on the page, use Add text.' })),
        h('a', { class: 'btn', href: '#/addtext' }, t({ id: 'Buka Tambah teks', en: 'Open Add text' }))));
      return;
    }
    fields.sort((a, b) => (a.page || 1e9) - (b.page || 1e9));
    const list = h('div', { class: 'formlist' });
    let lastPage = -1;
    for (const { f, page } of fields) {
      if (page !== lastPage) { list.append(h('h3', null, page ? t({ id: 'Halaman {n}', en: 'Page {n}' }, { n: page }) : t({ id: 'Lainnya', en: 'Other' }))); lastPage = page; }
      const name = f.getName(), label = pretty(name);
      const ro = f.isReadOnly();
      let ctl;
      if (f instanceof lib.PDFTextField) {
        const v = f.getText() || '';
        const multi = f.isMultiline();
        ctl = h(multi ? 'textarea' : 'input', { type: multi ? null : 'text', rows: multi ? 3 : null, value: v, maxlength: f.getMaxLength() || null, disabled: ro, oninput: (e) => values.set(name, e.target.value) });
        if (multi) ctl.value = v;
        list.append(field(label, ctl));
      } else if (f instanceof lib.PDFCheckBox) {
        list.append(h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: f.isChecked(), disabled: ro, onchange: (e) => values.set(name, e.target.checked) }), label));
      } else if (f instanceof lib.PDFRadioGroup) {
        const cur = f.getSelected();
        ctl = h('div', { class: 'radios' }, f.getOptions().map((o) => h('label', { class: 'check' }, h('input', { type: 'radio', name: 'r-' + name, value: o, checked: o === cur, disabled: ro, onchange: () => values.set(name, o) }), o)));
        list.append(field(label, ctl));
      } else if (f instanceof lib.PDFDropdown || f instanceof lib.PDFOptionList) {
        const cur = f.getSelected(); const many = f instanceof lib.PDFOptionList;
        ctl = h('select', { multiple: many || null, disabled: ro, onchange: (e) => values.set(name, many ? [...e.target.selectedOptions].map((o) => o.value) : e.target.value) },
          !many && h('option', { value: '' }, '—'), f.getOptions().map((o) => h('option', { value: o, selected: cur.includes(o) }, o)));
        list.append(field(label, ctl));
      }
    }
    ui.stage.append(list);
    ui.opts.append(
      h('p', null, t({ id: '{n} kolom bisa diisi.', en: '{n} fields to fill.' }, { n: fields.length })),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', onchange: (e) => (flat = e.target.checked) }), t({ id: 'Ratakan setelah diisi (jawaban tidak bisa diubah lagi)', en: 'Flatten after filling (answers can no longer change)' })));
    ui.setReady(true);
  });
}
