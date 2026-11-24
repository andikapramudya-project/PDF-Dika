import { h, t, stem, pdfLib, openPdf } from '../core.js';
import { shell, pageGrid } from '../ui.js';
import { singlePdf } from './_single.js';

/** Flatten every form field into plain page content. Returns the number of fields. */
export function flattenForm(doc) {
  const form = doc.getForm();
  const n = form.getFields().length;
  if (!n) return 0;
  try { form.flatten(); } catch { form.flatten({ updateFieldAppearances: false }); } // values with unusual characters keep their existing look
  return n;
}

export async function mount(root, tool) {
  let ctx;
  const ui = shell(root, {
    actionLabel: t({ id: 'Ratakan PDF', en: 'Flatten PDF' }),
    panelTitle: t({ id: 'Ratakan formulir', en: 'Flatten form' }),
    run: async () => {
      await pdfLib();
      const doc = await openPdf(ctx.bytes);
      const n = flattenForm(doc);
      return { files: [{ name: stem(ctx.file.name) + '-rata.pdf', data: await doc.save() }],
        summary: n
          ? t({ id: '{n} kolom formulir sekarang menjadi bagian halaman dan tidak bisa diubah lagi.', en: '{n} form fields are now part of the page and can no longer be changed.' }, { n })
          : t({ id: 'PDF ini tidak punya kolom formulir, jadi isinya tidak berubah.', en: 'This PDF has no form fields, so nothing changed.' }) };
    },
  });
  singlePdf(ui, tool, async (c) => {
    ctx = c;
    let count = 0;
    try { const doc = await openPdf(c.bytes); count = doc.getForm().getFields().length; } catch {}
    ui.opts.append(
      h('p', null, count
        ? t({ id: 'Ditemukan {n} kolom formulir. Isinya akan dikunci apa adanya.', en: 'Found {n} form fields. Their current values will be locked in.' }, { n: count })
        : t({ id: 'Tidak ada kolom formulir di PDF ini.', en: 'There are no form fields in this PDF.' })),
      h('p', { class: 'note' }, t({ id: 'Cocok sebelum mengirim formulir yang sudah diisi, agar penerima tidak bisa mengubah jawabannya.', en: 'Useful before sending a filled form, so the recipient cannot change the answers.' })));
    ui.stage.append(pageGrid({ pages: c.pages, mode: 'view' }).el);
    ui.setReady(count > 0);
  });
}
