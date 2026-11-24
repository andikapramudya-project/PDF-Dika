import { h, t, stem, openPdf, renderPage } from '../core.js';
import { shell, field, seg } from '../ui.js';
import { singlePdf } from './_single.js';
import { viewer, place, toPdfRect, contentBox } from './_viewer.js';

export async function mount(root, tool) {
  let ctx, v, mode = 'manual', scope = 'all';
  const box = { x0: 0.06, y0: 0.05, x1: 0.94, y1: 0.95 };
  const perPage = new Map(); // page -> box, when scope is "this page"

  const ui = shell(root, {
    actionLabel: t({ id: 'Potong PDF', en: 'Crop PDF' }),
    panelTitle: t({ id: 'Area potong', en: 'Crop area' }),
    run: async () => {
      const doc = await openPdf(ctx.bytes);
      const pages = doc.getPages();
      let n = 0;
      for (let i = 0; i < pages.length; i++) {
        const jp = await ctx.doc.getPage(i + 1);
        let b;
        if (mode === 'auto') b = contentBox(await renderPage(ctx.doc, i + 1, 420));
        else b = scope === 'all' ? box : perPage.get(i + 1);
        if (!b) continue;
        const [x, y, w, hh] = toPdfRect(jp, b);
        if (w < 10 || hh < 10) continue;
        pages[i].setCropBox(x, y, w, hh);
        pages[i].setTrimBox(x, y, w, hh);
        n++;
      }
      return { files: [{ name: stem(ctx.file.name) + '-dipotong.pdf', data: await doc.save() }],
        summary: t({ id: '{n} halaman dipotong. Isi di luar area masih ada di file, hanya disembunyikan.', en: '{n} pages cropped. Content outside the area is hidden, not deleted.' }, { n }) };
    },
  });

  function cropBox(layer, n) {
    const b = scope === 'all' ? box : perPage.get(n) || { ...box };
    if (scope === 'page') perPage.set(n, b);
    const el = h('div', { class: 'cropbox' }, ...['nw', 'ne', 'sw', 'se'].map((c) => h('span', { class: 'hd ' + c, 'data-c': c })));
    place(el, b);
    let drag = null;
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault(); el.setPointerCapture(e.pointerId);
      const r = layer.getBoundingClientRect();
      drag = { c: e.target.dataset.c || 'move', sx: e.clientX, sy: e.clientY, w: r.width, hgt: r.height, o: { ...b } };
    });
    el.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = (e.clientX - drag.sx) / drag.w, dy = (e.clientY - drag.sy) / drag.hgt, o = drag.o, min = 0.05;
      const cl = (x) => Math.min(1, Math.max(0, x));
      if (drag.c === 'move') {
        const w = o.x1 - o.x0, hh = o.y1 - o.y0;
        b.x0 = Math.min(1 - w, cl(o.x0 + dx)); b.y0 = Math.min(1 - hh, cl(o.y0 + dy)); b.x1 = b.x0 + w; b.y1 = b.y0 + hh;
      } else {
        if (drag.c.includes('w')) b.x0 = Math.min(cl(o.x0 + dx), b.x1 - min);
        if (drag.c.includes('e')) b.x1 = Math.max(cl(o.x1 + dx), b.x0 + min);
        if (drag.c.includes('n')) b.y0 = Math.min(cl(o.y0 + dy), b.y1 - min);
        if (drag.c.includes('s')) b.y1 = Math.max(cl(o.y1 + dy), b.y0 + min);
      }
      place(el, b);
    });
    el.addEventListener('pointerup', () => (drag = null));
    layer.append(el);
  }

  singlePdf(ui, tool, async (c) => {
    ctx = c;
    v = viewer(c.doc, {
      hint: t({ id: 'Geser kotak atau tarik sudutnya. Bagian di luar kotak akan dipotong.', en: 'Move the box or pull its corners. Everything outside is cropped.' }),
      onPage: (n, layer) => { if (mode === 'manual') cropBox(layer, n); else showAuto(n, layer); },
    });
    async function showAuto(n, layer) {
      const b = contentBox(await renderPage(c.doc, n, 420));
      if (!b) return;
      const el = h('div', { class: 'cropbox auto' }); place(el, b); layer.append(el);
    }
    const scopeSeg = field(t({ id: 'Terapkan ke', en: 'Apply to' }), seg([['all', t({ id: 'Semua halaman', en: 'All pages' })], ['page', t({ id: 'Per halaman', en: 'Page by page' })]], scope, (x) => { scope = x; pageNote.hidden = x !== 'page'; perPage.clear(); v.go(v.page); }));
    let pageNote;
    const autoNote = h('p', { class: 'note', hidden: true }, t({ id: 'Setiap halaman dipotong mengikuti isinya, jadi margin putih di sekeliling hilang.', en: 'Each page is cropped to its content, so the white margin around it goes away.' }));
    ui.opts.append(
      field(t({ id: 'Cara memotong', en: 'How to crop' }), seg([['manual', t({ id: 'Atur sendiri', en: 'Set by hand' })], ['auto', t({ id: 'Buang margin putih', en: 'Trim white margins' })]], mode, (x) => {
        mode = x; scopeSeg.hidden = x === 'auto'; pageNote.hidden = x === 'auto' || scope !== 'page'; autoNote.hidden = x !== 'auto'; v.go(v.page);
      })),
      scopeSeg, autoNote,
      pageNote = h('p', { class: 'note', hidden: true }, t({ id: 'Pada mode per halaman, setiap halaman yang kamu buka memakai kotaknya sendiri. Halaman yang tidak dibuka tidak dipotong.', en: 'In page-by-page mode each page you open keeps its own box. Pages you do not open stay as they are.' })));
    ui.stage.append(v.el);
    ui.setReady(true);
    await v.go(1);
  });
}
