import { h, t, pdfLib, readBytes, openPreview, openPdf, stem, UserError } from '../core.js';
import { dropzone, shell, takeHandoff, field, seg, fileList } from '../ui.js';
import { ocrDocument, recognizeCanvas } from './_ocr.js';
import { ocrWorker } from '../core.js';

export async function mount(root, tool) {
  const items = []; let langs = 'ind+eng', out = 'pdf';
  const status = h('p', { class: 'note', 'aria-live': 'polite' });
  const prog = h('div', { class: 'progress', hidden: true }, h('i'));
  const setProg = (f, msg) => { prog.hidden = false; prog.firstChild.style.width = Math.round(f * 100) + '%'; if (msg) status.textContent = msg; };
  const loadMsg = (m) => { if (m.status && /load|init/i.test(m.status)) status.textContent = t({ id: 'Menyiapkan mesin OCR (sekali saja, lalu tersimpan untuk offline)…', en: 'Preparing the OCR engine (once, then cached for offline)…' }); };

  const ui = shell(root, {
    actionLabel: t({ id: 'Kenali teks', en: 'Recognise text' }),
    panelTitle: t({ id: 'Pengaturan OCR', en: 'OCR settings' }),
    run: async () => {
      const { PDFDocument, StandardFonts } = await pdfLib();
      const outDoc = await PDFDocument.create();
      const font = await outDoc.embedFont(StandardFonts.Helvetica);
      const texts = [];
      let done = 0; const total = items.length;
      for (const it of items) {
        const isPdf = /pdf$/i.test(it.file.type) || /\.pdf$/i.test(it.file.name);
        if (isPdf) {
          const bytes = await readBytes(it.file);
          const src = await openPdf(bytes);
          const pdf = await openPreview(bytes);
          const pages = await ocrDocument(pdf, langs, (i, n) => setProg((done + i / n) / total, t({ id: 'Mengenali halaman {i} dari {n}…', en: 'Recognising page {i} of {n}…' }, { i, n })), loadMsg);
          const copied = await outDoc.copyPages(src, src.getPageIndices());
          copied.forEach((pg, i) => { outDoc.addPage(pg); overlay(pg, pages[i], font); texts.push(pages[i].text); });
        } else {
          const bmp = await createImageBitmap(it.file, { imageOrientation: 'from-image' });
          const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height; c.getContext('2d').drawImage(bmp, 0, 0);
          setProg(done / total, t({ id: 'Mengenali {f}…', en: 'Recognising {f}…' }, { f: it.file.name }));
          const worker = await ocrWorker(langs, loadMsg);
          const r = await recognizeCanvas(worker, c);
          const jpg = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.88));
          const img = await outDoc.embedJpg(new Uint8Array(await jpg.arrayBuffer()));
          const W = img.width * 0.75, H = img.height * 0.75; // ~96 DPI to points
          const pg = outDoc.addPage([W, H]); pg.drawImage(img, { x: 0, y: 0, width: W, height: H });
          overlay(pg, { ...r, vw: W, vh: H }, font); texts.push(r.text);
        }
        done++;
      }
      prog.hidden = true; status.textContent = '';
      const text = texts.join('\n\f\n');
      if (!text.trim()) throw new UserError(t({ id: 'Tidak ada teks yang dikenali. Pastikan scan cukup tajam dan bahasanya sesuai.', en: 'No text was recognised. Check that the scan is sharp and the language is right.' }));
      const base = stem(items[0].file.name);
      const files = out === 'pdf' ? [{ name: base + '-ocr.pdf', data: await outDoc.save() }] : [{ name: base + '-ocr.txt', data: new Blob([text], { type: 'text/plain;charset=utf-8' }) }];
      return { files, summary: out === 'pdf' ? t({ id: 'Teks sekarang bisa dicari, dipilih, dan disalin. Tampilan halaman tidak berubah.', en: 'Text can now be searched, selected and copied. Pages look the same.' }) : t({ id: 'Teks hasil OCR siap.', en: 'OCR text is ready.' }),
        extra: out === 'txt' ? h('textarea', { class: 'textout', readonly: true }, text) : null };
    },
  });
  ui.opts.append(
    field(t({ id: 'Bahasa dokumen', en: 'Document language' }), seg([['ind+eng', t({ id: 'Indonesia + Inggris', en: 'Indonesian + English' })], ['ind', 'Indonesia'], ['eng', t({ id: 'Inggris', en: 'English' })]], langs, (v) => (langs = v))),
    field(t({ id: 'Hasil', en: 'Output' }), seg([['pdf', t({ id: 'PDF bisa dicari', en: 'Searchable PDF' })], ['txt', t({ id: 'Teks (.txt)', en: 'Text (.txt)' })]], out, (v) => (out = v))),
    h('p', { class: 'note' }, t({ id: 'Pengenalan teks berjalan di perangkatmu. Pertama kali dipakai, mesin OCR (sekitar 8 MB) diunduh dari situs ini lalu disimpan untuk offline.', en: 'Recognition runs on your device. The first time, the OCR engine (about 8 MB) downloads from this site and is kept for offline use.' })),
    prog, status);
  const list = fileList({ items, onChange: update, thumb: async (it) => { if (it.file.type.startsWith('image/')) { const i = new Image(); i.src = URL.createObjectURL(it.file); return i; } const { renderPage } = await import('../core.js'); const d = await openPreview(await readBytes(it.file)); return renderPage(d, 1, 44); } });
  const big = dropzone({ accept: tool.accept, multiple: true, onFiles: add, label: t({ id: 'Pilih PDF hasil scan atau foto dokumen', en: 'Choose a scanned PDF or document photos' }) });
  const more = dropzone({ accept: tool.accept, multiple: true, onFiles: add, compact: true, label: t({ id: 'Tambah file', en: 'Add files' }) });
  ui.stage.append(big);
  function add(files) { files.forEach((file) => items.push({ file })); list.render(); update(); }
  function update() { ui.stage.replaceChildren(...(items.length ? [list.el, more] : [big])); if (items.length) ui.setReady(true); else ui.hidePanel(); }
  const pre = takeHandoff(tool.accept, true); if (pre) add(pre);
}

/** Invisible, selectable text placed over each recognised word. */
function overlay(page, r, font) {
  const { width: W, height: H } = page.getSize();
  const rot = page.getRotation().angle % 360;
  const [VW, VH] = rot % 180 ? [H, W] : [W, H];
  const sx = VW / r.width, sy = VH / r.height;
  const map = (vx, vy) => ({ 0: [vx, vy], 90: [W - vy, vx], 180: [W - vx, H - vy], 270: [vy, H - vx] }[rot] || [vx, vy]);
  for (const w of r.words) {
    const text = w.text.replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
    if (!text) continue;
    const bw = (w.x1 - w.x0) * sx, bh = (w.y1 - w.y0) * sy;
    const unit = font.widthOfTextAtSize(text, 1) || 1;
    const size = Math.max(2, Math.min(bw / unit, bh * 1.4));
    const [x, y] = map(w.x0 * sx, VH - w.y1 * sy + bh * 0.15);
    page.drawText(text, { x, y, size, font, opacity: 0, rotate: { type: 'degrees', angle: rot } });
  }
}
