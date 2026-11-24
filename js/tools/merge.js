import { h, t, pdfLib, readBytes, openPdf, openPreview, renderPage, stem } from '../core.js';
import { dropzone, fileList, shell, takeHandoff } from '../ui.js';

export async function mount(root, tool) {
  const items = [];
  const ui = shell(root, {
    actionLabel: t({ id: 'Gabungkan PDF', en: 'Merge PDFs' }),
    panelTitle: t({ id: 'Urutan file', en: 'File order' }),
    run: async () => {
      const { PDFDocument } = await pdfLib();
      const out = await PDFDocument.create();
      for (const it of items) {
        const src = await openPdf(it.bytes);
        const pages = await out.copyPages(src, src.getPageIndices());
        pages.forEach((p) => out.addPage(p));
      }
      const data = await out.save();
      return { files: [{ name: (items.length ? stem(items[0].file.name) : 'pdfdika') + '-gabungan.pdf', data }],
        summary: t({ id: '{n} file digabung menjadi {p} halaman.', en: '{n} files merged into {p} pages.' }, { n: items.length, p: out.getPageCount() }) };
    },
  });
  ui.opts.append(h('p', { class: 'note' }, t({ id: 'Seret kartu atau pakai tombol panah untuk mengubah urutan. File paling atas jadi halaman pertama.', en: 'Drag cards or use the arrows to change order. The top file becomes the first pages.' })));

  const list = fileList({ items, onChange: update, thumb: async (it) => { const d = await openPreview(it.bytes); return renderPage(d, 1, 44); } });
  const big = dropzone({ accept: tool.accept, multiple: true, onFiles: add });
  const more = dropzone({ accept: tool.accept, multiple: true, onFiles: add, compact: true, label: t({ id: 'Tambah PDF lain', en: 'Add more PDFs' }) });
  ui.stage.append(big);

  async function add(files) {
    for (const file of files) {
      const bytes = await readBytes(file);
      let info = '';
      try { const d = await openPreview(bytes); info = t({ id: '{n} halaman', en: '{n} pages' }, { n: d.numPages }); } catch { info = '?'; }
      items.push({ file, bytes, info });
    }
    list.render(); update();
  }
  function update() {
    if (items.length) ui.stage.replaceChildren(list.el, more); else ui.stage.replaceChildren(big);
    ui.setReady(items.length >= 2);
    if (!items.length) ui.hidePanel();
  }
  const pre = takeHandoff(tool.accept, true); if (pre) add(pre);
}
