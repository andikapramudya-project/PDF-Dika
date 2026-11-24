import { h, t, stem, renderPage, JSZip } from '../core.js';
import { shell, pageGrid, field, seg } from '../ui.js';
import { singlePdf } from './_single.js';

export async function mount(root, tool) {
  let ctx, fmt = 'jpeg', dpi = 150;
  const prog = h('div', { class: 'progress', hidden: true }, h('i'));
  const ui = shell(root, {
    actionLabel: t({ id: 'Ubah ke gambar', en: 'Convert to images' }),
    panelTitle: t({ id: 'Format', en: 'Format' }),
    run: async () => {
      const { doc, file } = ctx; const base = stem(file.name); const ext = fmt === 'jpeg' ? 'jpg' : 'png';
      const files = []; prog.hidden = false;
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const vp = page.getViewport({ scale: 1 });
        const c = await renderPage(doc, i, vp.width * (dpi / 72) / Math.min(window.devicePixelRatio || 1, 2));
        const blob = await new Promise((r) => c.toBlob(r, 'image/' + fmt, 0.9));
        files.push({ name: `${base}-${String(i).padStart(String(doc.numPages).length, '0')}.${ext}`, data: blob, type: blob.type });
        prog.firstChild.style.width = (i / doc.numPages * 100) + '%';
      }
      prog.hidden = true;
      if (files.length === 1) return { files, summary: t({ id: '1 halaman disimpan sebagai gambar.', en: '1 page saved as an image.' }) };
      const Zip = await JSZip(); const zip = new Zip();
      files.forEach((f) => zip.file(f.name, f.data));
      return { files: [{ name: base + '-gambar.zip', data: await zip.generateAsync({ type: 'blob' }), type: 'application/zip' }, ...files],
        summary: t({ id: '{n} halaman disimpan sebagai {f}.', en: '{n} pages saved as {f}.' }, { n: files.length, f: ext.toUpperCase() }) };
    },
  });
  singlePdf(ui, tool, (c) => {
    ctx = c;
    ui.opts.append(
      field(t({ id: 'Jenis gambar', en: 'Image type' }), seg([['jpeg', 'JPG'], ['png', 'PNG']], fmt, (v) => (fmt = v))),
      field(t({ id: 'Ketajaman', en: 'Sharpness' }), seg([[72, t({ id: 'Rendah', en: 'Low' })], [150, t({ id: 'Sedang', en: 'Medium' })], [300, t({ id: 'Tinggi', en: 'High' })]], dpi, (v) => (dpi = v)), t({ id: 'Tinggi = 300 DPI, cocok untuk cetak tapi file lebih besar.', en: 'High = 300 DPI, good for print but larger files.' })),
      prog);
    ui.stage.append(pageGrid({ pages: c.pages, mode: 'view' }).el);
    ui.setReady(true);
  });
}
