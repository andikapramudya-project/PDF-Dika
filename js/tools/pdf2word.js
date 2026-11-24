import { h, t, JSZip, stem } from '../core.js';
import { shell, pageGrid } from '../ui.js';
import { singlePdf } from './_single.js';
import { readBook } from './reflow.js';
import { chapters } from '../reflow/engine.js';
import { toDOCX } from '../reflow/export.js';

export async function mount(root, tool) {
  let ctx; const opts = { images: true, dropRunning: true };
  const prog = h('div', { class: 'progress', hidden: true }, h('i'));
  const ui = shell(root, {
    actionLabel: t({ id: 'Ubah ke Word', en: 'Convert to Word' }),
    panelTitle: t({ id: 'Pengaturan', en: 'Settings' }),
    run: async () => {
      prog.hidden = false;
      const book = await readBook(ctx.file, opts, (n, tt) => (prog.firstChild.style.width = (n / tt * 100) + '%'));
      book.chapters = chapters(book.blocks, book.title);
      prog.hidden = true;
      return { files: [{ name: stem(ctx.file.name) + '.docx', data: await toDOCX(book, await JSZip()) }],
        summary: t({ id: 'Teks, judul, huruf miring dan tebal, serta gambar dipindahkan ke dokumen Word yang bisa diedit. Tata letak mengikuti alur teks, bukan posisi persis di PDF.', en: 'Text, headings, italics, bold and images moved into an editable Word document. Layout follows the text flow, not exact PDF positions.' }) };
    },
  });
  singlePdf(ui, tool, (c) => {
    ctx = c;
    const chk = (k, label) => h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: true, onchange: (e) => (opts[k] = e.target.checked) }), t(label));
    ui.opts.append(chk('images', { id: 'Sertakan gambar', en: 'Include images' }), chk('dropRunning', { id: 'Buang header, footer, dan nomor halaman', en: 'Remove headers, footers and page numbers' }), prog);
    ui.stage.append(pageGrid({ pages: c.pages, mode: 'view' }).el);
    ui.setReady(true);
  });
}
