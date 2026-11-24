import { h, t, stem } from '../core.js';
import { shell, pageGrid } from '../ui.js';
import { singlePdf } from './_single.js';

export async function mount(root, tool) {
  let ctx;
  const ui = shell(root, {
    actionLabel: t({ id: 'Ambil teks', en: 'Extract text' }),
    run: async () => {
      const { doc, file } = ctx; const parts = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const tc = await (await doc.getPage(i)).getTextContent();
        let line = '', out = '', lastY = null;
        for (const it of tc.items) {
          const y = it.transform?.[5];
          if (lastY !== null && Math.abs(y - lastY) > 2) { out += line.trimEnd() + '\n'; line = ''; }
          line += it.str + (it.hasEOL ? '\n' : ''); lastY = y;
        }
        out += line;
        parts.push(`--- ${t({ id: 'Halaman', en: 'Page' })} ${i} ---\n` + out.replace(/\n{3,}/g, '\n\n').trim());
      }
      const text = parts.join('\n\n');
      const empty = !text.replace(/--- .*? ---/g, '').trim();
      const area = h('textarea', { class: 'textout', readonly: true }, text);
      return { files: [{ name: stem(file.name) + '.txt', data: new Blob([text], { type: 'text/plain;charset=utf-8' }) }],
        summary: empty ? t({ id: 'Tidak ada teks yang bisa dibaca. Kemungkinan PDF ini hasil scan; alat OCR akan hadir di tahap berikutnya.', en: 'No readable text found. This PDF is probably a scan; OCR arrives in the next release.' }) : t({ id: 'Teks dari {n} halaman. Kamu juga bisa menyalinnya di bawah.', en: 'Text from {n} pages. You can also copy it below.' }, { n: doc.numPages }),
        extra: empty ? null : area };
    },
  });
  singlePdf(ui, tool, (c) => { ctx = c; ui.stage.append(pageGrid({ pages: c.pages, mode: 'view' }).el); ui.setReady(true); });
}
