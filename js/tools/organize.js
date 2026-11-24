import { h, t, stem, pdfLib, openPdf, reportError, UserError } from '../core.js';
import { shell, pageGrid, dropzone, pagesOf, takeHandoff } from '../ui.js';

export async function mount(root, tool) {
  const pages = []; const sources = []; let grid;
  const ui = shell(root, {
    actionLabel: t({ id: 'Simpan PDF', en: 'Save PDF' }),
    panelTitle: t({ id: 'Atur halaman', en: 'Organize' }),
    run: async () => {
      if (!pages.length) throw new UserError(t({ id: 'Tidak ada halaman tersisa.', en: 'No pages left.' }));
      const { PDFDocument, degrees } = await pdfLib();
      const out = await PDFDocument.create();
      const loaded = new Map();
      for (const p of pages) {
        if (!loaded.has(p.bytes)) loaded.set(p.bytes, await openPdf(p.bytes));
        const [pg] = await out.copyPages(loaded.get(p.bytes), [p.srcIndex]);
        if (p.rotation) pg.setRotation(degrees((pg.getRotation().angle + p.rotation) % 360));
        out.addPage(pg);
      }
      return { files: [{ name: stem(sources[0].name) + '-diatur.pdf', data: await out.save() }],
        summary: t({ id: 'PDF baru berisi {n} halaman.', en: 'New PDF with {n} pages.' }, { n: pages.length }) };
    },
  });
  const big = dropzone({ accept: tool.accept, multiple: true, onFiles: add });
  const more = dropzone({ accept: tool.accept, multiple: true, onFiles: add, compact: true, label: t({ id: 'Tambah PDF lain', en: 'Add another PDF' }) });
  const count = h('p', { class: 'note' });
  ui.stage.append(big);
  ui.opts.append(
    h('p', { class: 'note' }, t({ id: 'Seret halaman untuk mengubah urutan. Pakai tombol di bawah tiap halaman untuk memutar, menggandakan, atau menghapus.', en: 'Drag pages to reorder. Use the buttons under each page to rotate, duplicate or delete.' })),
    h('button', { class: 'btn small', type: 'button', onclick: () => { pages.sort((a, b) => sources.indexOf(a.file) - sources.indexOf(b.file) || a.srcIndex - b.srcIndex); grid?.render(); sync(); } }, t({ id: 'Urutkan ulang seperti asli', en: 'Restore original order' })),
    count);

  async function add(files) {
    try {
      for (const f of files) {
        await openPdf(new Uint8Array(await f.arrayBuffer()));
        const tag = sources.length > 0 || files.length > 1 ? String.fromCharCode(65 + sources.length) : null;
        sources.push(f);
        const r = await pagesOf(f, tag);
        r.pages.forEach((p) => (p.file = f));
        if (sources.length === 2) pages.forEach((p) => (p.tag ||= 'A'));
        pages.push(...r.pages);
      }
      grid = pageGrid({ pages, mode: 'organize', tags: true, onChange: sync });
      ui.stage.replaceChildren(grid.el, h('div', { style: { marginTop: '14px' } }, more));
      sync();
    } catch (e) { reportError(e); }
  }
  function sync() {
    count.textContent = t({ id: '{n} halaman dari {f} file.', en: '{n} pages from {f} file(s).' }, { n: pages.length, f: sources.length });
    ui.setReady(pages.length > 0);
  }
  const pre = takeHandoff(tool.accept, true); if (pre) add(pre);
}
