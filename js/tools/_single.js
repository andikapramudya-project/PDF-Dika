// Shared flow for tools that work on one PDF: drop → load → onLoad(ctx).
import { h, t, readBytes, openPreview, openPdf, reportError } from '../core.js';
import { dropzone, takeHandoff } from '../ui.js';

export function singlePdf(ui, tool, onLoad) {
  const big = dropzone({ accept: tool.accept, onFiles: (f) => load(f[0]) });
  ui.stage.append(big);
  async function load(file) {
    try {
      const bytes = await readBytes(file);
      await openPdf(bytes); // validates + detects encryption with a plain message
      const doc = await openPreview(bytes);
      const pages = Array.from({ length: doc.numPages }, (_, i) => ({ doc, srcIndex: i, rotation: 0, selected: false }));
      const swap = h('div', { class: 'row', style: { justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap' } },
        h('div', { style: { flex: '1 1 auto', minWidth: 0 } }, h('b', { style: { display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, file.name),
          h('span', { class: 'note' }, t({ id: '{n} halaman', en: '{n} pages' }, { n: doc.numPages }))),
        h('button', { class: 'btn small', type: 'button', style: { flex: 'none' }, onclick: () => { ui.stage.replaceChildren(big); ui.hidePanel(); ui.opts.replaceChildren(); } }, t({ id: 'Ganti file', en: 'Change file' })));
      ui.stage.replaceChildren(swap);
      ui.opts.replaceChildren();
      await onLoad({ file, bytes, doc, pages });
    } catch (e) { reportError(e); }
  }
  const pre = takeHandoff(tool.accept, false); if (pre) load(pre[0]);
}

/** Copy pages (with rotation offsets) into a new document. list: [{srcIndex, rotation}] */
export async function buildFrom(bytes, list) {
  const { PDFDocument, degrees } = await import('../../vendor/pdf-lib.esm.min.js');
  const src = await openPdf(bytes);
  const out = await PDFDocument.create();
  const copied = await out.copyPages(src, list.map((p) => p.srcIndex));
  copied.forEach((pg, i) => {
    const r = list[i].rotation || 0;
    if (r) pg.setRotation(degrees((pg.getRotation().angle + r) % 360));
    out.addPage(pg);
  });
  return out;
}
