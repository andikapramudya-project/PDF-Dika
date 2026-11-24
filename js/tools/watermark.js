import { h, t, stem, pdfLib, openPdf, hexToRgb, winAnsiSafe, renderPage, UserError } from '../core.js';
import { shell, field, seg, range } from '../ui.js';
import { singlePdf } from './_single.js';

export async function mount(root, tool) {
  let ctx, preview;
  const o = { text: t({ id: 'RAHASIA', en: 'CONFIDENTIAL' }), size: 60, opacity: 0.2, angle: 45, color: '#C2264B', layout: 'center', bold: true };
  const ui = shell(root, {
    actionLabel: t({ id: 'Tambahkan watermark', en: 'Add watermark' }),
    panelTitle: t({ id: 'Watermark', en: 'Watermark' }),
    run: async () => {
      if (!o.text.trim()) throw new UserError(t({ id: 'Tulis teks watermark dulu.', en: 'Type the watermark text first.' }));
      const { StandardFonts, rgb, degrees } = await pdfLib();
      const doc = await openPdf(ctx.bytes);
      const font = await doc.embedFont(o.bold ? StandardFonts.HelveticaBold : StandardFonts.Helvetica);
      const text = winAnsiSafe(o.text);
      const [r, g, b] = hexToRgb(o.color);
      for (const page of doc.getPages()) {
        const { width: W, height: H } = page.getSize();
        const rot = page.getRotation().angle;
        const tw = font.widthOfTextAtSize(text, o.size), th = font.heightAtSize(o.size);
        const a = (o.angle + rot) * Math.PI / 180; // keep text upright relative to how the page is shown
        const draw = (cx, cy) => page.drawText(text, {
          x: cx - (tw / 2) * Math.cos(a) + (th / 3) * Math.sin(a), y: cy - (tw / 2) * Math.sin(a) - (th / 3) * Math.cos(a),
          size: o.size, font, color: rgb(r, g, b), opacity: o.opacity, rotate: degrees(o.angle + rot),
        });
        if (o.layout === 'center') draw(W / 2, H / 2);
        else {
          const stepX = tw * 0.9 + 60, stepY = th * 4 + 40;
          for (let y = -H; y < H * 2; y += stepY) for (let x = -W; x < W * 2; x += stepX) draw(x + ((y / stepY) % 2 ? stepX / 2 : 0), y);
        }
      }
      return { files: [{ name: stem(ctx.file.name) + '-watermark.pdf', data: await doc.save() }], summary: t({ id: 'Watermark ditambahkan ke {n} halaman.', en: 'Watermark added to {n} pages.' }, { n: doc.getPageCount() }) };
    },
  });
  singlePdf(ui, tool, async (c) => {
    ctx = c;
    const txt = h('input', { type: 'text', value: o.text, oninput: () => { o.text = txt.value; draw(); } });
    const col = h('input', { type: 'color', value: o.color, oninput: () => { o.color = col.value; draw(); } });
    ui.opts.append(
      field(t({ id: 'Teks', en: 'Text' }), txt),
      field(t({ id: 'Susunan', en: 'Layout' }), seg([['center', t({ id: 'Satu di tengah', en: 'One, centred' })], ['tile', t({ id: 'Berulang', en: 'Tiled' })]], o.layout, (v) => { o.layout = v; draw(); })),
      field(t({ id: 'Ukuran huruf', en: 'Font size' }), range(12, 160, 2, o.size, (v) => { o.size = v; draw(); }, (v) => v + 'pt')),
      field(t({ id: 'Transparansi', en: 'Opacity' }), range(0.05, 1, 0.05, o.opacity, (v) => { o.opacity = v; draw(); }, (v) => Math.round(v * 100) + '%')),
      field(t({ id: 'Kemiringan', en: 'Angle' }), seg([[0, '0°'], [45, '45°'], [90, '90°'], [-45, '−45°']], o.angle, (v) => { o.angle = v; draw(); })),
      h('div', { class: 'row' }, field(t({ id: 'Warna', en: 'Colour' }), col),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: o.bold, onchange: (e) => { o.bold = e.target.checked; draw(); } }), t({ id: 'Tebal', en: 'Bold' }))));
    const wrap = h('div', { class: 'canvas-wrap', style: { maxWidth: '560px' } });
    const base = await renderPage(c.doc, 1, 560);
    preview = h('canvas'); preview.width = base.width; preview.height = base.height; wrap.append(preview);
    ui.stage.append(h('p', { class: 'note', style: { marginBottom: '10px' } }, t({ id: 'Pratinjau halaman 1', en: 'Preview of page 1' })), wrap);
    function draw() {
      const g = preview.getContext('2d'); g.drawImage(base, 0, 0);
      const page1 = c.doc; // scale from points to preview pixels
      page1.getPage(1).then((p) => {
        const vp = p.getViewport({ scale: 1 }); const k = preview.width / vp.width;
        g.save(); g.globalAlpha = o.opacity; g.fillStyle = o.color;
        g.font = `${o.bold ? 700 : 400} ${o.size * k}px Helvetica, Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        const one = (x, y) => { g.save(); g.translate(x, y); g.rotate(-o.angle * Math.PI / 180); g.fillText(o.text, 0, 0); g.restore(); };
        if (o.layout === 'center') one(preview.width / 2, preview.height / 2);
        else { const tw = g.measureText(o.text).width; const sx = tw * 0.9 + 60 * k, sy = o.size * k * 4 + 40 * k; let row = 0;
          for (let y = -preview.height; y < preview.height * 2; y += sy, row++) for (let x = -preview.width; x < preview.width * 2; x += sx) one(x + (row % 2 ? sx / 2 : 0), y); }
        g.restore();
      });
    }
    draw(); ui.setReady(true);
  });
}
