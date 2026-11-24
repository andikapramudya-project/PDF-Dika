import { h, t, stem, openPdf } from '../core.js';
import { shell, field } from '../ui.js';
import { singlePdf } from './_single.js';

export async function mount(root, tool) {
  let ctx;
  const f = {
    title: h('input', { type: 'text' }), author: h('input', { type: 'text' }), subject: h('input', { type: 'text' }),
    keywords: h('input', { type: 'text' }), creator: h('input', { type: 'text' }), producer: h('input', { type: 'text' }),
  };
  const ui = shell(root, {
    actionLabel: t({ id: 'Simpan properti', en: 'Save properties' }),
    run: async () => {
      const doc = await openPdf(ctx.bytes);
      doc.setTitle(f.title.value); doc.setAuthor(f.author.value); doc.setSubject(f.subject.value);
      doc.setKeywords(f.keywords.value.split(',').map((s) => s.trim()).filter(Boolean));
      doc.setCreator(f.creator.value); doc.setProducer(f.producer.value); doc.setModificationDate(new Date());
      return { files: [{ name: stem(ctx.file.name) + '.pdf', data: await doc.save() }], summary: t({ id: 'Properti dokumen diperbarui.', en: 'Document properties updated.' }) };
    },
  });
  singlePdf(ui, tool, async (c) => {
    ctx = c;
    const doc = await openPdf(c.bytes);
    f.title.value = doc.getTitle() || ''; f.author.value = doc.getAuthor() || ''; f.subject.value = doc.getSubject() || '';
    f.keywords.value = doc.getKeywords() || ''; f.creator.value = doc.getCreator() || ''; f.producer.value = doc.getProducer() || '';
    const form = h('div', { class: 'panel', style: { position: 'static' } },
      field(t({ id: 'Judul', en: 'Title' }), f.title), field(t({ id: 'Penulis', en: 'Author' }), f.author),
      field(t({ id: 'Subjek', en: 'Subject' }), f.subject), field(t({ id: 'Kata kunci', en: 'Keywords' }), f.keywords, t({ id: 'Pisahkan dengan koma.', en: 'Separate with commas.' })),
      field(t({ id: 'Aplikasi pembuat', en: 'Creator app' }), f.creator), field(t({ id: 'Producer', en: 'Producer' }), f.producer));
    ui.stage.append(form);
    ui.opts.append(h('p', { class: 'note' }, t({ id: 'Properti ini terlihat di menu info dokumen pada pembaca PDF dan mesin pencari.', en: 'These show up in the document info of PDF readers and search engines.' })));
    ui.setReady(true);
  });
}
