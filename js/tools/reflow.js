import { h, t, svg, I, pdfjs, pdfLib, JSZip, readBytes, openPreview, download, stem, reportError, winAnsiSafe, UserError, renderPage } from '../core.js';
import { dropzone, takeHandoff, field } from '../ui.js';
import { extract, chapters } from '../reflow/engine.js';
import { buildReaderHTML, blobToDataURL } from '../reflow/reader.js';
import { toEPUB, toDOCX, toPhonePDF } from '../reflow/export.js';
import { getLang } from '../core.js';

/** Shared by the reflow and PDF-to-Word tools. */
export async function readBook(file, opts, onProgress) {
  const bytes = await readBytes(file);
  let pdf;
  try { pdf = await openPreview(bytes); }
  catch (e) {
    if (/password/i.test(e?.name + e?.message)) throw new UserError(t({ id: 'PDF ini dikunci kata sandi. Buka kuncinya dulu, lalu coba lagi.', en: 'This PDF is password-protected. Unlock it first, then try again.' }));
    throw new UserError(t({ id: 'File ini tidak bisa dibaca sebagai PDF.', en: 'This file could not be read as a PDF.' }));
  }
  const lib = await pdfjs();
  const res = await extract(pdf, lib, { ...opts, onProgress });
  res.title ||= stem(file.name).replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
  res.pdf = pdf;
  return res;
}

const L = {
  reading: { id: 'Membaca halaman {n} dari {t}…', en: 'Reading page {n} of {t}…' },
  images: { id: 'Menyiapkan gambar {n} dari {t}…', en: 'Preparing image {n} of {t}…' },
  html: { id: 'Unduh HTML offline', en: 'Download offline HTML' },
  epub: { id: 'Unduh EPUB', en: 'Download EPUB' },
  docx: { id: 'Unduh Word (DOCX)', en: 'Download Word (DOCX)' },
  phone: { id: 'Unduh PDF ukuran HP', en: 'Download phone-size PDF' },
  full: { id: 'Baca layar penuh', en: 'Read full screen' },
};

export async function mount(root, tool) {
  const work = h('div', { class: 'work' });
  const stage = h('div', { class: 'stage' });
  const panel = h('aside', { class: 'panel', hidden: true });
  work.append(stage, panel); root.append(work);
  const opts = { images: true, dropRunning: true };
  let file, book, html;

  const big = dropzone({ accept: tool.accept, onFiles: (f) => start(f[0]), label: t({ id: 'Pilih PDF buku atau tarik ke sini', en: 'Choose a book PDF or drop it here' }), sub: t({ id: 'Cocok untuk novel, buku, modul, dan jurnal. File tetap di perangkatmu.', en: 'Works for novels, books, handouts and papers. Files stay on your device.' }) });
  stage.append(big, explainer());

  async function start(f) {
    file = f; panel.hidden = true; work.classList.add('single');
    const msg = h('p', { class: 'note' }, t({ id: 'Membuka PDF…', en: 'Opening PDF…' }));
    const bar = h('div', { class: 'progress' }, h('i'));
    stage.replaceChildren(h('section', { class: 'result', 'aria-live': 'polite' }, h('h2', null, h('span', { class: 'spin', style: { width: '22px', height: '22px', border: '3px solid var(--accent)', borderRightColor: 'transparent', borderRadius: '50%', animation: 'spin .7s linear infinite' } }), f.name), msg, bar));
    try {
      book = await readBook(f, opts, (n, total, phase) => {
        msg.textContent = t(phase === 'images' ? L.images : L.reading, { n, t: total });
        bar.firstChild.style.width = (n / total * 100) + '%';
      });
      book.chapters = chapters(book.blocks, book.title);
      if (!book.blocks.some((b) => b.type === 'p')) {
        stage.replaceChildren(h('section', { class: 'result' },
          h('h2', null, t({ id: 'Tidak ada teks yang bisa disusun ulang', en: 'No text to reflow' })),
          h('p', null, t({ id: 'PDF ini sepertinya hasil scan (berisi gambar halaman). PDFDika bisa mengenali teksnya dengan OCR dulu, langsung di perangkatmu.', en: 'This PDF looks like a scan (images of pages). PDFDika can recognise its text with OCR first, right on your device.' })),
          h('div', { class: 'acts' },
            h('button', { class: 'btn primary', type: 'button', style: { width: 'auto' }, onclick: () => runOcr('ind+eng') }, t({ id: 'Kenali teks (Indonesia + Inggris)', en: 'Recognise text (Indonesian + English)' })),
            h('button', { class: 'btn', type: 'button', onclick: reset }, t({ id: 'Pilih PDF lain', en: 'Choose another PDF' })))));
        return;
      }
      await showResult();
    } catch (e) { reportError(e); reset(); }
  }

  async function runOcr(langs) {
    const msg = h('p', { class: 'note' }, t({ id: 'Menyiapkan mesin OCR…', en: 'Preparing the OCR engine…' }));
    const bar = h('div', { class: 'progress' }, h('i'));
    stage.replaceChildren(h('section', { class: 'result', 'aria-live': 'polite' }, h('h2', null, t({ id: 'Mengenali teks', en: 'Recognising text' })), msg, bar));
    try {
      const { ocrDocument, ocrToBlocks } = await import('./_ocr.js');
      const pages = await ocrDocument(book.pdf, langs, (i, n) => { msg.textContent = t({ id: 'Mengenali halaman {i} dari {n}…', en: 'Recognising page {i} of {n}…' }, { i, n }); bar.firstChild.style.width = (i / n * 100) + '%'; });
      book.blocks = ocrToBlocks(pages);
      book.chapters = chapters(book.blocks, book.title);
      if (!book.blocks.length) throw new UserError(t({ id: 'Tidak ada teks yang dikenali dari scan ini.', en: 'No text could be recognised in this scan.' }));
      await showResult();
    } catch (e) { reportError(e); reset(); }
  }

  function reset() { stage.replaceChildren(big, explainer()); panel.hidden = true; work.classList.add('single'); }

  async function makeHTML() {
    const cache = new Map();
    return buildReaderHTML(book, { uiLang: getLang(), imgSrc: async (b) => { if (!cache.has(b)) cache.set(b, await blobToDataURL(b.blob)); return cache.get(b); } });
  }

  async function showResult() {
    html = await makeHTML();
    const frame = h('iframe', { class: 'reader-frame', title: t({ id: 'Pratinjau mode baca', en: 'Reading view preview' }) });
    frame.srcdoc = html;
    const paras = book.blocks.filter((b) => b.type === 'p').length;
    const imgs = book.blocks.filter((b) => b.type === 'img').length;
    const openFull = () => { const u = URL.createObjectURL(new Blob([html], { type: 'text/html' })); window.open(u, '_blank', 'noopener'); setTimeout(() => URL.revokeObjectURL(u), 60000); };
    stage.replaceChildren(
      h('div', { class: 'row', style: { justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' } },
        h('div', { style: { minWidth: 0, flex: '1 1 200px' } }, h('b', { style: { display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, file.name),
          h('span', { class: 'note' }, t({ id: '{p} halaman jadi {c} bab, {n} paragraf, {i} gambar', en: '{p} pages into {c} chapters, {n} paragraphs, {i} images' }, { p: book.stats.pages, c: book.chapters.length, n: paras, i: imgs }))),
        h('div', { class: 'row', style: { flex: 'none', gap: '8px' } },
          h('button', { class: 'btn small', type: 'button', onclick: openFull }, t(L.full)),
          h('button', { class: 'btn small', type: 'button', onclick: reset }, t({ id: 'Ganti file', en: 'Change file' })))),
      h('div', { class: 'reader-shell' }, frame));

    const title = h('input', { type: 'text', value: book.title });
    const author = h('input', { type: 'text', value: book.author || '' });
    const meta = () => { book.title = title.value.trim() || stem(file.name); book.author = author.value.trim(); };
    const rerun = (key) => h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: opts[key], onchange: (e) => { opts[key] = e.target.checked; start(file); } }),
      t(key === 'images' ? { id: 'Sertakan gambar', en: 'Include images' } : { id: 'Buang header, footer, dan nomor halaman', en: 'Remove headers, footers and page numbers' }));
    const action = (label, fn, primary) => {
      const b = h('button', { class: 'btn' + (primary ? ' primary' : ''), type: 'button' }, h('span', { html: svg(I.download), style: { width: '18px', display: 'inline-flex' } }), label);
      b.addEventListener('click', async () => {
        if (b.disabled) return; b.disabled = true; meta();
        try { await fn(); } catch (e) { reportError(e); } finally { b.disabled = false; }
      });
      if (!primary) b.style.width = '100%';
      return b;
    };
    const base = () => stem(file.name);
    panel.replaceChildren(
      h('h3', null, t({ id: 'Simpan untuk dibaca', en: 'Save for reading' })),
      action(t(L.html), async () => { html = await makeHTML(); download(new Blob([html], { type: 'text/html;charset=utf-8' }), base() + '.html'); }, true),
      action(t(L.epub), async () => {
        const Zip = await JSZip();
        const cover = await renderPage(book.pdf, 1, 700).then((c) => new Promise((r) => c.toBlob((blob) => r({ blob }), 'image/jpeg', 0.85)));
        download(await toEPUB(book, Zip, { cover }), base() + '.epub', 'application/epub+zip');
      }),
      action(t(L.docx), async () => download(await toDOCX(book, await JSZip()), base() + '.docx')),
      action(t(L.phone), async () => download(await toPhonePDF(book, await pdfLib(), winAnsiSafe), base() + '-hp.pdf')),
      h('hr', { class: 'sep' }),
      field(t({ id: 'Judul buku', en: 'Book title' }), title),
      field(t({ id: 'Penulis', en: 'Author' }), author),
      rerun('dropRunning'), rerun('images'),
      h('p', { class: 'note' }, t({ id: 'EPUB bisa dibuka di Google Play Books, Apple Books, atau dikirim ke Kindle.', en: 'EPUB opens in Google Play Books and Apple Books, or send it to Kindle.' })));
    panel.hidden = false; work.classList.remove('single');
  }

  const pre = takeHandoff(tool.accept, false); if (pre) start(pre[0]);
}

function explainer() {
  const item = (a, b) => h('div', null, h('h3', null, t(a)), h('p', null, t(b)));
  return h('section', { class: 'how', style: { marginTop: '28px' } },
    item({ id: 'Teks mengalir mengikuti layar', en: 'Text flows to fit the screen' }, { id: 'Tidak perlu zoom dan geser. Kolom digabung jadi satu alur, kata terpotong disambung lagi.', en: 'No zooming or panning. Columns merge into one flow and split words are rejoined.' }),
    item({ id: 'Nyaman untuk lama membaca', en: 'Comfortable for long reads' }, { id: 'Atur ukuran huruf, jarak baris, lebar teks, dan tema terang, sepia, atau gelap. Posisi baca diingat.', en: 'Adjust text size, spacing, width and a light, sepia or dark theme. Your place is remembered.' }),
    item({ id: 'Bawa ke mana saja', en: 'Take it anywhere' }, { id: 'Simpan sebagai HTML offline, EPUB, Word, atau PDF ukuran HP.', en: 'Save as offline HTML, EPUB, Word or a phone-size PDF.' }));
}
