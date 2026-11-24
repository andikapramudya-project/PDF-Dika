import { h, t, svg, I, stem, pdfLib, openPdf, toast } from '../core.js';
import { shell } from '../ui.js';
import { singlePdf } from './_single.js';

const IND = '<path d="M4 6h16M10 12h10M10 18h10M4 10l3 2-3 2"/>';
const OUT = '<path d="M4 6h16M10 12h10M10 18h10M7 10l-3 2 3 2"/>';

/** Read the existing outline as a flat list [{title, page, level}]. */
async function readOutline(pdf) {
  const outline = await pdf.getOutline().catch(() => null);
  const list = [];
  const walk = async (nodes, level) => {
    for (const n of nodes || []) {
      let page = 1;
      try {
        let dest = n.dest;
        if (typeof dest === 'string') dest = await pdf.getDestination(dest);
        if (Array.isArray(dest)) page = (typeof dest[0] === 'number' ? dest[0] : await pdf.getPageIndex(dest[0])) + 1;
      } catch {}
      list.push({ title: n.title || '', page, level });
      await walk(n.items, level + 1);
    }
  };
  await walk(outline, 0);
  return list;
}

/** Guess chapter headings from font sizes. */
async function guessHeadings(pdf) {
  const pages = [];
  const sizes = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const tc = await (await pdf.getPage(i)).getTextContent();
    const lines = new Map();
    for (const it of tc.items) {
      if (!it.str?.trim()) continue;
      const size = Math.round(Math.hypot(it.transform[2], it.transform[3]) * 10) / 10;
      const y = Math.round(it.transform[5]);
      sizes.push(...Array(Math.min(it.str.length, 200)).fill(size));
      const key = y + ':' + size;
      const l = lines.get(key) || { y, size, text: '' };
      l.text += (l.text && !l.text.endsWith(' ') && !it.str.startsWith(' ') ? ' ' : '') + it.str;
      lines.set(key, l);
    }
    pages.push([...lines.values()].sort((a, b) => b.y - a.y));
  }
  sizes.sort((a, b) => a - b);
  const body = sizes[Math.floor(sizes.length / 2)] || 10;
  const big = [...new Set(pages.flat().filter((l) => l.size >= body * 1.25).map((l) => l.size))].sort((a, b) => b - a);
  const out = [];
  pages.forEach((lines, i) => {
    for (const l of lines) {
      const text = l.text.replace(/\s+/g, ' ').trim();
      if (l.size < body * 1.25 || text.length < 2 || text.length > 90 || /^\d+$/.test(text)) continue;
      const prev = out[out.length - 1];
      if (prev && prev.page === i + 1 && prev._size === l.size) { prev.title += ' ' + text; continue; } // heading over two lines
      out.push({ title: text, page: i + 1, level: Math.min(big.indexOf(l.size), 2), _size: l.size });
    }
  });
  return out.slice(0, 300).map(({ _size, ...x }) => x);
}

/** Replace the document outline with the given flat list. */
function writeOutline(doc, items, lib) {
  const { PDFName, PDFHexString, PDFNumber, PDFNull } = lib;
  const ctx = doc.context, pages = doc.getPages();
  const root = { ref: ctx.nextRef(), kids: [] };
  const stack = [root];
  for (const it of items) {
    const node = { ...it, ref: ctx.nextRef(), kids: [] };
    const lvl = Math.min(it.level, stack.length - 1);
    stack.length = lvl + 1;
    node.parent = stack[lvl];
    stack[lvl].kids.push(node);
    stack.push(node);
  }
  const count = (n) => n.kids.reduce((s, k) => s + 1 + count(k), 0);
  const emit = (n) => {
    n.kids.forEach((k, i) => {
      const page = pages[Math.min(Math.max(k.page, 1), pages.length) - 1];
      const box = page.getMediaBox();
      const d = ctx.obj({});
      d.set(PDFName.of('Title'), PDFHexString.fromText(k.title || '—'));
      d.set(PDFName.of('Parent'), n.ref);
      d.set(PDFName.of('Dest'), ctx.obj([page.ref, PDFName.of('XYZ'), PDFNull, PDFNumber.of(box.y + box.height), PDFNull]));
      if (i > 0) d.set(PDFName.of('Prev'), n.kids[i - 1].ref);
      if (i < n.kids.length - 1) d.set(PDFName.of('Next'), n.kids[i + 1].ref);
      if (k.kids.length) { d.set(PDFName.of('First'), k.kids[0].ref); d.set(PDFName.of('Last'), k.kids[k.kids.length - 1].ref); d.set(PDFName.of('Count'), PDFNumber.of(k.level === 0 ? count(k) : -count(k))); }
      ctx.assign(k.ref, d);
      emit(k);
    });
  };
  emit(root);
  const rd = ctx.obj({ Type: 'Outlines' });
  if (root.kids.length) { rd.set(PDFName.of('First'), root.kids[0].ref); rd.set(PDFName.of('Last'), root.kids[root.kids.length - 1].ref); rd.set(PDFName.of('Count'), PDFNumber.of(root.kids.length)); }
  ctx.assign(root.ref, rd);
  doc.catalog.set(PDFName.of('Outlines'), root.ref);
  if (root.kids.length) doc.catalog.set(PDFName.of('PageMode'), PDFName.of('UseOutlines'));
}

export async function mount(root, tool) {
  let ctx, items = [];
  const list = h('ol', { class: 'bmlist' });
  const ui = shell(root, {
    actionLabel: t({ id: 'Simpan bookmark', en: 'Save bookmarks' }),
    panelTitle: t({ id: 'Bookmark', en: 'Bookmarks' }),
    run: async () => {
      const lib = await pdfLib();
      const doc = await openPdf(ctx.bytes);
      const clean = items.filter((x) => x.title.trim());
      for (let i = 0; i < clean.length; i++) clean[i].level = Math.min(clean[i].level, i ? clean[i - 1].level + 1 : 0);
      writeOutline(doc, clean, lib);
      return { files: [{ name: stem(ctx.file.name) + '-bookmark.pdf', data: await doc.save() }],
        summary: t({ id: '{n} bookmark tersimpan. Buka panel bookmark atau daftar isi di aplikasi PDF untuk melihatnya.', en: '{n} bookmarks saved. Open the bookmarks or outline panel in your PDF app to see them.' }, { n: clean.length }) };
    },
  });

  function render() {
    const max = ctx.doc.numPages;
    list.replaceChildren(...items.map((it, i) => {
      const btn = (ic, label, fn, dis) => h('button', { class: 'mini', type: 'button', title: label, 'aria-label': label, disabled: dis, html: svg(ic), onclick: () => { fn(); render(); } });
      return h('li', { class: 'bm', style: '--lvl:' + it.level },
        h('input', { type: 'text', value: it.title, 'aria-label': t({ id: 'Judul', en: 'Title' }), placeholder: t({ id: 'Judul bookmark', en: 'Bookmark title' }), oninput: (e) => (it.title = e.target.value) }),
        h('input', { type: 'number', class: 'pg', min: 1, max, value: it.page, 'aria-label': t({ id: 'Halaman', en: 'Page' }), oninput: (e) => (it.page = Math.min(max, Math.max(1, +e.target.value || 1))) }),
        h('div', { class: 'acts' },
          btn(OUT, t({ id: 'Naikkan tingkat', en: 'Outdent' }), () => it.level--, it.level === 0),
          btn(IND, t({ id: 'Jadikan sub-bab', en: 'Indent' }), () => it.level++, i === 0 || it.level > items[i - 1].level),
          btn(I.up, t({ id: 'Naikkan', en: 'Move up' }), () => items.splice(i - 1, 0, items.splice(i, 1)[0]), i === 0),
          btn(I.down, t({ id: 'Turunkan', en: 'Move down' }), () => items.splice(i + 1, 0, items.splice(i, 1)[0]), i === items.length - 1),
          btn(I.trash, t({ id: 'Hapus', en: 'Remove' }), () => items.splice(i, 1))));
    }));
    if (!items.length) list.append(h('li', { class: 'note' }, t({ id: 'Belum ada bookmark. Tambahkan sendiri atau buat otomatis dari judul.', en: 'No bookmarks yet. Add them yourself or generate them from headings.' })));
  }

  singlePdf(ui, tool, async (c) => {
    ctx = c;
    items = await readOutline(c.doc);
    const add = h('button', { class: 'btn small', type: 'button', onclick: () => { items.push({ title: '', page: items.at(-1)?.page || 1, level: 0 }); render(); list.lastChild.querySelector('input')?.focus(); } },
      h('span', { html: svg(I.plus), style: { width: '18px', display: 'inline-flex' } }), t({ id: 'Tambah bookmark', en: 'Add bookmark' }));
    const auto = h('button', { class: 'btn small', type: 'button', onclick: async () => {
      auto.disabled = true;
      const found = await guessHeadings(c.doc);
      auto.disabled = false;
      if (!found.length) return toast(t({ id: 'Tidak ada judul yang terdeteksi. Coba tambahkan sendiri.', en: 'No headings detected. Try adding them yourself.' }));
      items = found; render();
      toast(t({ id: '{n} judul ditemukan. Periksa dan rapikan sebelum menyimpan.', en: '{n} headings found. Check and tidy them before saving.' }, { n: found.length }));
    } }, t({ id: 'Buat dari judul', en: 'From headings' }));
    ui.stage.append(h('div', { class: 'bm-tools' }, add, auto), list);
    ui.opts.append(
      h('p', null, items.length ? t({ id: 'PDF ini sudah punya {n} bookmark. Ubah, tambah, atau hapus sesuai kebutuhan.', en: 'This PDF already has {n} bookmarks. Edit, add or remove as needed.' }, { n: items.length }) : t({ id: 'PDF ini belum punya bookmark.', en: 'This PDF has no bookmarks yet.' })),
      h('p', { class: 'note' }, t({ id: 'Bookmark muncul sebagai daftar isi yang bisa diklik di aplikasi PDF dan e-reader.', en: 'Bookmarks show up as a clickable table of contents in PDF apps and e-readers.' })));
    render();
    ui.setReady(true);
  });
}
