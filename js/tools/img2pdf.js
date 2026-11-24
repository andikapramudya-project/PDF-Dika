import { h, t, pdfLib, readBytes, stem } from '../core.js';
import { dropzone, fileList, shell, takeHandoff, field, seg } from '../ui.js';

// EXIF orientation of a JPEG (1 = normal). Phones often store rotated photos with a flag.
function jpegOrientation(b) {
  if (b[0] !== 0xff || b[1] !== 0xd8) return 1;
  let i = 2;
  while (i < b.length - 4) {
    if (b[i] !== 0xff) return 1;
    const marker = b[i + 1], len = (b[i + 2] << 8) | b[i + 3];
    if (marker === 0xe1 && String.fromCharCode(...b.slice(i + 4, i + 8)) === 'Exif') {
      const s = i + 10, le = b[s] === 0x49;
      const u16 = (o) => (le ? b[s + o] | (b[s + o + 1] << 8) : (b[s + o] << 8) | b[s + o + 1]);
      const u32 = (o) => (le ? (b[s + o] | (b[s + o + 1] << 8) | (b[s + o + 2] << 16) | (b[s + o + 3] << 24)) : ((b[s + o] << 24) | (b[s + o + 1] << 16) | (b[s + o + 2] << 8) | b[s + o + 3])) >>> 0;
      const ifd = u32(4), n = u16(ifd);
      for (let k = 0; k < n; k++) { const e = ifd + 2 + k * 12; if (u16(e) === 0x0112) return u16(e + 8); }
      return 1;
    }
    i += 2 + len;
  }
  return 1;
}

async function toCanvasBytes(file, type) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
  const ctx = c.getContext('2d');
  if (type === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); }
  ctx.drawImage(bmp, 0, 0);
  const blob = await new Promise((r) => c.toBlob(r, type, 0.92));
  return new Uint8Array(await blob.arrayBuffer());
}

export async function mount(root, tool) {
  const items = [];
  let size = 'fit', orient = 'auto', margin = 0;
  const ui = shell(root, {
    actionLabel: t({ id: 'Buat PDF', en: 'Create PDF' }),
    panelTitle: t({ id: 'Halaman', en: 'Page setup' }),
    run: async () => {
      const { PDFDocument } = await pdfLib();
      const doc = await PDFDocument.create();
      for (const it of items) {
        const f = it.file; let img;
        if (f.type === 'image/jpeg' || /\.jpe?g$/i.test(f.name)) {
          const b = await readBytes(f);
          img = jpegOrientation(b) > 1 ? await doc.embedJpg(await toCanvasBytes(f, 'image/jpeg')) : await doc.embedJpg(b);
        } else if (f.type === 'image/png') img = await doc.embedPng(await readBytes(f));
        else img = await doc.embedPng(await toCanvasBytes(f, 'image/png'));
        let W, H;
        if (size === 'fit') { W = img.width * 0.75 + margin * 2; H = img.height * 0.75 + margin * 2; }
        else {
          [W, H] = size === 'a4' ? [595.28, 841.89] : [612, 792];
          const land = orient === 'landscape' || (orient === 'auto' && img.width > img.height);
          if (land) [W, H] = [H, W];
        }
        const page = doc.addPage([W, H]);
        const s = Math.min((W - margin * 2) / img.width, (H - margin * 2) / img.height);
        const w = img.width * s, hh = img.height * s;
        page.drawImage(img, { x: (W - w) / 2, y: (H - hh) / 2, width: w, height: hh });
      }
      return { files: [{ name: (items.length === 1 ? stem(items[0].file.name) : 'gambar-pdfdika') + '.pdf', data: await doc.save() }],
        summary: t({ id: '{n} gambar menjadi PDF.', en: '{n} images turned into a PDF.' }, { n: items.length }) };
    },
  });
  const orientField = field(t({ id: 'Orientasi', en: 'Orientation' }), seg([['auto', t({ id: 'Otomatis', en: 'Auto' })], ['portrait', t({ id: 'Tegak', en: 'Portrait' })], ['landscape', t({ id: 'Mendatar', en: 'Landscape' })]], orient, (v) => (orient = v)));
  ui.opts.append(
    field(t({ id: 'Ukuran halaman', en: 'Page size' }), seg([['fit', t({ id: 'Sesuai gambar', en: 'Match image' })], ['a4', 'A4'], ['letter', 'Letter']], size, (v) => { size = v; orientField.hidden = v === 'fit'; })),
    orientField,
    field(t({ id: 'Margin', en: 'Margin' }), seg([[0, t({ id: 'Tanpa', en: 'None' })], [18, t({ id: 'Kecil', en: 'Small' })], [40, t({ id: 'Besar', en: 'Large' })]], margin, (v) => (margin = v))));
  orientField.hidden = true;

  const list = fileList({ items, onChange: update, thumb: async (it) => { const i = new Image(); i.src = URL.createObjectURL(it.file); i.alt = ''; return i; } });
  const big = dropzone({ accept: tool.accept, multiple: true, onFiles: add, label: t({ id: 'Pilih gambar atau tarik ke sini', en: 'Choose images or drop them here' }) });
  const more = dropzone({ accept: tool.accept, multiple: true, onFiles: add, compact: true, label: t({ id: 'Tambah gambar', en: 'Add images' }) });
  ui.stage.append(big);
  function add(files) { files.forEach((file) => items.push({ file })); list.render(); update(); }
  function update() {
    ui.stage.replaceChildren(...(items.length ? [list.el, more] : [big]));
    if (items.length) ui.setReady(true); else ui.hidePanel();
  }
  const pre = takeHandoff(tool.accept, true); if (pre) add(pre);
}
