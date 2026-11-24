import { h, t, stem, openPdf } from '../core.js';
import { shell } from '../ui.js';
import { singlePdf } from './_single.js';

export async function mount(root, tool) {
  let ctx;
  const ui = shell(root, {
    actionLabel: t({ id: 'Hapus metadata', en: 'Remove metadata' }),
    run: async () => {
      const { PDFName } = await import('../../vendor/pdf-lib.esm.min.js');
      const doc = await openPdf(ctx.bytes);
      doc.setTitle(''); doc.setAuthor(''); doc.setSubject(''); doc.setKeywords([]); doc.setCreator(''); doc.setProducer('');
      doc.setCreationDate(new Date(0)); doc.setModificationDate(new Date(0));
      const info = doc.context.lookup(doc.context.trailerInfo.Info);
      if (info?.keys) for (const k of info.keys()) info.delete(k);
      doc.catalog.delete(PDFName.of('Metadata')); // XMP packet
      return { files: [{ name: stem(ctx.file.name) + '-bersih.pdf', data: await doc.save({ useObjectStreams: true }) }],
        summary: t({ id: 'Judul, penulis, tanggal, aplikasi pembuat, dan data XMP sudah dihapus.', en: 'Title, author, dates, creator app and XMP data have been removed.' }) };
    },
  });
  singlePdf(ui, tool, async (c) => {
    ctx = c;
    const doc = await openPdf(c.bytes);
    const rows = [[{ id: 'Judul', en: 'Title' }, doc.getTitle()], [{ id: 'Penulis', en: 'Author' }, doc.getAuthor()], [{ id: 'Subjek', en: 'Subject' }, doc.getSubject()],
      [{ id: 'Kata kunci', en: 'Keywords' }, doc.getKeywords()], [{ id: 'Aplikasi pembuat', en: 'Creator' }, doc.getCreator()], ['Producer', doc.getProducer()],
      [{ id: 'Dibuat', en: 'Created' }, doc.getCreationDate()?.toLocaleString()], [{ id: 'Diubah', en: 'Modified' }, doc.getModificationDate()?.toLocaleString()]];
    ui.stage.append(h('section', { class: 'result' }, h('h2', { style: { fontSize: '1.15rem' } }, t({ id: 'Yang tersimpan di file ini', en: 'What this file contains' })),
      h('ul', { class: 'outlist' }, rows.map(([k, v]) => h('li', null, h('span', null, t(k)), h('b', { style: { fontWeight: 600, textAlign: 'right', overflowWrap: 'anywhere' } }, v || '—'))))));
    ui.opts.append(h('p', { class: 'note' }, t({ id: 'Isi halaman tidak berubah. Hanya data tersembunyi tentang dokumen yang dihapus.', en: 'Page content stays the same. Only hidden details about the document are removed.' })));
    ui.setReady(true);
  });
}
