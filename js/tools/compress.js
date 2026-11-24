import { h, t, pdfLib, openPdf, stem, fmtSize, qpdf } from '../core.js';
import { shell, field, seg } from '../ui.js';
import { singlePdf } from './_single.js';

const LEVELS = {
  light: { q: 0.82, max: 2400 },
  medium: { q: 0.68, max: 1700 },
  strong: { q: 0.5, max: 1150 },
};

async function toJpeg(canvas, q) { const b = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', q)); return new Uint8Array(await b.arrayBuffer()); }

/** Re-encode photos inside the PDF as smaller JPEGs. Returns number of images changed. */
async function shrinkImages(doc, lib, { q, max }) {
  const { PDFName, PDFRawStream, PDFNumber, decodePDFRawStream } = lib;
  let changed = 0;
  for (const [ref, obj] of doc.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue;
    const d = obj.dict;
    if (d.get(PDFName.of('Subtype'))?.toString() !== '/Image') continue;
    if (d.get(PDFName.of('ImageMask')) || d.get(PDFName.of('SMask')) || d.get(PDFName.of('Mask'))) continue; // keep transparency intact
    const w = d.get(PDFName.of('Width'))?.asNumber?.(), hgt = d.get(PDFName.of('Height'))?.asNumber?.();
    if (!w || !hgt || w * hgt < 40000) continue; // tiny images are not worth it
    const filter = d.get(PDFName.of('Filter'))?.toString() || '';
    const cs = d.get(PDFName.of('ColorSpace'))?.toString() || '';
    const bpc = d.get(PDFName.of('BitsPerComponent'))?.asNumber?.();
    let bmp;
    try {
      if (filter === '/DCTDecode') {
        if (cs === '/DeviceCMYK') continue;
        bmp = await createImageBitmap(new Blob([obj.contents], { type: 'image/jpeg' }));
      } else if ((filter === '/FlateDecode' || filter === '') && bpc === 8 && (cs === '/DeviceRGB' || cs === '/DeviceGray')) {
        const raw = decodePDFRawStream(obj).decode();
        const n = cs === '/DeviceRGB' ? 3 : 1;
        if (raw.length < w * hgt * n) continue;
        const img = new ImageData(w, hgt);
        for (let i = 0, j = 0; i < w * hgt; i++, j += n) { const p = i * 4; img.data[p] = raw[j]; img.data[p + 1] = raw[j + (n === 3 ? 1 : 0)]; img.data[p + 2] = raw[j + (n === 3 ? 2 : 0)]; img.data[p + 3] = 255; }
        bmp = await createImageBitmap(img);
      } else continue;
    } catch { continue; }
    const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(bmp.width * s)); c.height = Math.max(1, Math.round(bmp.height * s));
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0, c.width, c.height);
    if (cs === '/DeviceGray') { const id = g.getImageData(0, 0, c.width, c.height); g.putImageData(id, 0, 0); }
    const jpg = await toJpeg(c, q);
    if (jpg.length >= obj.contents.length * 0.92) continue; // only keep real savings
    const nd = d.clone(doc.context);
    nd.set(PDFName.of('Filter'), PDFName.of('DCTDecode'));
    nd.delete(PDFName.of('DecodeParms')); nd.delete(PDFName.of('Decode'));
    nd.set(PDFName.of('Width'), PDFNumber.of(c.width)); nd.set(PDFName.of('Height'), PDFNumber.of(c.height));
    nd.set(PDFName.of('ColorSpace'), PDFName.of('DeviceRGB')); nd.set(PDFName.of('BitsPerComponent'), PDFNumber.of(8));
    nd.set(PDFName.of('Length'), PDFNumber.of(jpg.length));
    doc.context.assign(ref, PDFRawStream.of(nd, jpg));
    changed++;
  }
  return changed;
}

export async function mount(root, tool) {
  let ctx, level = 'medium';
  const ui = shell(root, {
    actionLabel: t({ id: 'Kompres PDF', en: 'Compress PDF' }),
    panelTitle: t({ id: 'Tingkat kompresi', en: 'Compression level' }),
    run: async () => {
      const lib = await pdfLib();
      const doc = await openPdf(ctx.bytes);
      const n = await shrinkImages(doc, lib, LEVELS[level]);
      let bytes = await doc.save({ useObjectStreams: true });
      try { // lossless pass: recompress streams and pack objects
        bytes = (await qpdf()).run(['--object-streams=generate', '--compress-streams=y', '--recompress-flate', '--compression-level=9', '--remove-unreferenced-resources=yes', '{in}', '{out}'], bytes);
      } catch (e) { console.warn('qpdf pass skipped', e); }
      if (bytes.length >= ctx.bytes.length) bytes = ctx.bytes; // never hand back a bigger file
      const saved = 1 - bytes.length / ctx.bytes.length;
      return { files: [{ name: stem(ctx.file.name) + '-kecil.pdf', data: bytes }],
        summary: saved > 0.005
          ? t({ id: '{a} menjadi {b} (hemat {p}%). {n} gambar dikompres ulang.', en: '{a} became {b} ({p}% smaller). {n} images re-compressed.' }, { a: fmtSize(ctx.bytes.length), b: fmtSize(bytes.length), p: Math.round(saved * 100), n })
          : t({ id: 'File ini sudah cukup ringkas, jadi ukurannya tidak berubah ({a}).', en: 'This file is already compact, so its size did not change ({a}).' }, { a: fmtSize(ctx.bytes.length) }) };
    },
  });
  singlePdf(ui, tool, (c) => {
    ctx = c;
    const hint = h('p', { class: 'note' });
    const notes = {
      light: { id: 'Kualitas gambar hampir sama dengan aslinya. Cocok untuk dicetak.', en: 'Images look almost like the original. Good for printing.' },
      medium: { id: 'Seimbang antara ukuran dan kualitas. Cocok untuk email dan WhatsApp.', en: 'Balanced size and quality. Good for email and chat.' },
      strong: { id: 'Ukuran paling kecil. Gambar terlihat lebih kasar saat diperbesar.', en: 'Smallest size. Images look rougher when zoomed in.' },
    };
    const set = (v) => { level = v; hint.textContent = t(notes[v]); };
    ui.opts.append(seg([['light', t({ id: 'Ringan', en: 'Light' })], ['medium', t({ id: 'Sedang', en: 'Medium' })], ['strong', t({ id: 'Kuat', en: 'Strong' })]], level, set), hint,
      h('p', { class: 'note' }, t({ id: 'Ukuran asli: {s}. Teks tetap tajam karena hanya gambar yang dikompres.', en: 'Original size: {s}. Text stays sharp; only images are compressed.' }, { s: fmtSize(c.bytes.length) })));
    set(level);
    ui.setReady(true);
  });
}
