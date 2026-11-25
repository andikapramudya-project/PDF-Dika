import { h, t, $, svg, I, getLang, setLang, LS, handoff, reportError } from './core.js';
import { TOOLS, CATS, byId, catOf } from './tools.js';

const app = $('#app');
const L = {
  h1: { id: 'Semua alat PDF, langsung di browser.', en: 'Every PDF tool, right in your browser.' },
  lede: { id: 'Gratis, tanpa unggahan, dan tetap bisa dipakai offline.', en: 'Free, no uploads, and it keeps working offline.' },
  ctaPick: { id: 'Pilih file', en: 'Choose a file' },
  ctaRead: { id: 'Coba Mode baca', en: 'Try reading mode' },
  ctaTools: { id: 'Lihat semua alat', en: 'See all tools' },
  demoK: { id: 'Contoh alat: Mode baca', en: 'Tool example: Reading mode' },
  demoT: { id: 'Ubah PDF jadi bacaan yang nyaman di HP', en: 'Turn a PDF into comfortable phone reading' },
  demo1: { id: 'Kolom digabung, kata yang terpotong di akhir baris disambung lagi, header dan nomor halaman dibuang.', en: 'Columns merge, words split across lines are rejoined, headers and page numbers are dropped.' },
  demo2: { id: 'Huruf miring, tebal, judul bab, dan gambar tetap ikut, lengkap dengan daftar isi.', en: 'Italics, bold, chapter headings and images come along, with a table of contents.' },
  demo3: { id: 'Hasilnya satu file HTML yang bisa dibaca tanpa internet, atau EPUB untuk aplikasi e-book.', en: 'You get one HTML file that reads without internet, or an EPUB for e-book apps.' },
  demoTry: { id: 'Coba ganti tema dan ukuran huruf', en: 'Try the theme and text size' },
  p1: { id: 'Tanpa unggahan', en: 'No uploads' },
  p2: { id: 'Tanpa akun', en: 'No account' },
  p3: { id: 'Bisa dipakai offline', en: 'Works offline' },
  sheetT: { id: 'Taruh PDF atau gambar di sini', en: 'Drop a PDF or images here' },
  sheetS: { id: 'Lalu pilih alat yang dibutuhkan', en: 'Then pick the tool you need' },
  pickedT: { id: '{n} file siap. Mau diapakan?', en: '{n} file(s) ready. What would you like to do?' },
  pickedS: { id: 'Pilih alat. File langsung dibuka di sana.', en: 'Pick a tool. Your files open there straight away.' },
  search: { id: 'Cari alat, misalnya “gabung”', en: 'Search tools, e.g. “merge”' },
  all: { id: 'Semua', en: 'All' },
  soon: { id: 'Segera', en: 'Soon' },
  none: { id: 'Tidak ada alat yang cocok dengan “{q}”.', en: 'No tool matches “{q}”.' },
  clear: { id: 'Hapus pencarian', en: 'Clear search' },
  ready: { id: '{n} alat siap', en: '{n} tools ready' },
  later: { id: 'hadir di tahap berikutnya', en: 'coming in the next release' },
  back: { id: 'Semua alat', en: 'All tools' },
  soonT: { id: 'Alat ini sedang dibuat', en: 'This tool is on the way' },
  soonP: { id: '{name} masuk tahap berikutnya PDFDika. Sementara itu, coba alat lain yang sudah tersedia.', en: '{name} is part of the next PDFDika release. Meanwhile, try one of the tools that are ready.' },
  how1: { id: 'File tetap di perangkatmu', en: 'Files stay on your device' },
  how2: { id: 'Bisa dipakai offline', en: 'Works offline' },
  how3: { id: 'Gratis, tanpa batas', en: 'Free, no limits' },
  src: { id: 'Kode sumber', en: 'Source code' },
  install: { id: 'Pasang', en: 'Install' },
  skip: { id: 'Lewati ke konten', en: 'Skip to content' },
};

const HOW = {
  shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  offline: '<path d="M12 4v11M7 10l5 5 5-5"/><path d="M5 20h14"/>',
  free: '<path d="M7 9.5a2.5 2.5 0 1 0 0 5c2.5 0 7.5-5 10-5a2.5 2.5 0 1 1 0 5c-2.5 0-7.5-5-10-5z"/>',
};

let state = { q: '', cat: 'all' };

function toolCard(tool) {
  const cat = catOf(tool.cat);
  return h('a', { class: 'tool' + (tool.status === 'soon' ? ' is-soon' : ''), href: '#/' + tool.id, style: `--cat:${cat.color}` },
    h('span', { class: 'ic', html: svg(tool.icon) }),
    h('b', null, t(tool.name)),
    h('span', null, t(tool.desc)),
    tool.status === 'soon' && h('em', { class: 'soon' }, t(L.soon)));
}

function matches(tool, q) {
  if (!q) return true;
  const hay = [tool.name.id, tool.name.en, tool.desc.id, tool.desc.en, tool.kw || '', tool.id].join(' ').toLowerCase();
  return q.toLowerCase().split(/\s+/).every((w) => hay.includes(w));
}

// A small live preview of the reader so visitors can feel it before choosing a file.
function demo() {
  const text = getLang() === 'id'
    ? ['Bab 2', 'Kereta Terakhir', 'Peron sudah hampir kosong ketika Sekar sampai. Lampu-lampu kuning memantul di lantai yang baru dipel, dan dari ujung lorong terdengar pengumuman yang diulang dua kali, seolah petugasnya sendiri tidak yakin ada yang mendengar.', 'Ia duduk di bangku paling dekat tangga. Di pangkuannya, sebuah buku tebal terbuka di halaman yang sama sejak minggu lalu.']
    : ['Chapter 2', 'The Last Train', 'The platform was almost empty when Sekar arrived. Yellow lights shone on the freshly mopped floor, and an announcement echoed twice down the corridor, as if the staff were not sure anyone was listening.', 'She sat on the bench nearest the stairs. In her lap, a thick book lay open at the same page it had been on since last week.'];
  let size = 15, theme = 'light';
  const phone = h('div', { class: 'phone', 'data-theme': theme });
  const body = h('div', { class: 'phone-body', style: { fontSize: size + 'px' } },
    h('h4', null, text[0], h('br'), text[1]), h('p', null, text[2]), h('p', null, text[3]));
  const sizeBtn = (label, d, aria) => h('button', { type: 'button', 'aria-label': aria, onclick: () => { size = Math.max(12, Math.min(20, size + d)); body.style.fontSize = size + 'px'; } }, label);
  phone.append(h('div', { class: 'phone-bar' }, h('span', null, t({ id: 'Daftar isi', en: 'Contents' })),
    sizeBtn('A−', -1, t({ id: 'Perkecil huruf', en: 'Smaller text' })), sizeBtn('A+', 1, t({ id: 'Perbesar huruf', en: 'Larger text' }))), body);
  const themes = [['light', t({ id: 'Terang', en: 'Light' })], ['sepia', 'Sepia'], ['dark', t({ id: 'Gelap', en: 'Dark' })]];
  const sw = h('div', { class: 'demo-themes', role: 'group', 'aria-label': t(L.demoTry) });
  const drawSw = () => sw.replaceChildren(...themes.map(([v, l]) => h('button', { type: 'button', class: 'demo-sw sw-' + v, 'aria-pressed': String(v === theme), onclick: () => { theme = v; phone.dataset.theme = v; drawSw(); } }, l)));
  drawSw();
  const page = h('div', { class: 'mini-page', 'aria-hidden': 'true' }, h('div', { class: 'mini-col' }, ...Array.from({ length: 14 }, () => h('i'))), h('div', { class: 'mini-col' }, ...Array.from({ length: 14 }, () => h('i'))));
  return h('section', { class: 'demo' },
    h('div', { class: 'demo-copy' },
      h('p', { class: 'kicker' }, t(L.demoK)),
      h('h2', null, t(L.demoT)),
      h('ul', null, h('li', null, t(L.demo1)), h('li', null, t(L.demo2)), h('li', null, t(L.demo3))),
      h('a', { class: 'btn', href: '#/reflow' }, t(L.ctaRead))),
    h('div', { class: 'demo-visual' }, page, h('span', { class: 'demo-arrow', html: svg(I.right) }), h('div', { class: 'demo-phone' }, phone, sw)));
}

function renderHome() {
  const dir = h('div');
  const input = h('input', { type: 'search', placeholder: t(L.search), 'aria-label': t(L.search), value: state.q, autocomplete: 'off' });
  const chips = h('div', { class: 'chips', role: 'group' });
  const drawChips = () => chips.replaceChildren(
    h('button', { class: 'chip', type: 'button', 'aria-pressed': String(state.cat === 'all'), onclick: () => { state.cat = 'all'; drawChips(); drawDir(); } }, t(L.all)),
    ...CATS.map((c) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(state.cat === c.id), onclick: () => { state.cat = c.id; drawChips(); drawDir(); } }, h('span', { class: 'cic', html: svg(c.icon) }), t(c.name))));
  const drawDir = () => {
    const groups = CATS.filter((c) => state.cat === 'all' || state.cat === c.id).map((c) => {
      const list = TOOLS.filter((x) => x.cat === c.id && matches(x, state.q))
        .sort((a, b) => (a.status === 'soon') - (b.status === 'soon'));
      if (!list.length) return null;
      const ready = list.filter((x) => x.status === 'ready').length;
      return h('section', { class: 'group' },
        h('h2', null, t(c.name), h('small', null, ready ? t(L.ready, { n: ready }) : t(L.later))),
        h('div', { class: 'grid' }, list.map(toolCard)));
    }).filter(Boolean);
    dir.replaceChildren(...(groups.length ? groups : [h('div', { class: 'empty' },
      h('p', null, t(L.none, { q: state.q })),
      h('button', { class: 'btn small', type: 'button', onclick: () => { state.q = ''; input.value = ''; state.cat = 'all'; drawChips(); drawDir(); input.focus(); } }, t(L.clear)))]));
  };
  input.addEventListener('input', () => { state.q = input.value.trim(); drawDir(); });
  drawChips(); drawDir();

  // Hero drop target: hold files, then offer the tools that accept them.
  const picked = h('div', { class: 'picked', hidden: true });
  const fileIn = h('input', { type: 'file', multiple: true, accept: '.pdf,application/pdf,image/*', class: 'sr', tabindex: '-1' });
  const sheet = h('div', { class: 'sheet', role: 'button', tabindex: '0', 'aria-label': t(L.sheetT) },
    h('div', { class: 'sheet-in' }, h('span', { html: svg(I.upload) }), h('strong', null, t(L.sheetT)), h('span', null, t(L.sheetS))),
    h('div', { class: 'sheet-lines', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')), fileIn);
  const takeFiles = (files) => {
    files = [...files].filter((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name) || f.type.startsWith('image/'));
    if (!files.length) return;
    handoff.files = files;
    const allImg = files.every((f) => f.type.startsWith('image/'));
    const anyImg = files.some((f) => f.type.startsWith('image/'));
    const fit = TOOLS.filter((x) => x.status === 'ready' && (allImg ? x.id === 'img2pdf' : anyImg ? x.id === 'img2pdf' || x.id === 'merge' : x.id !== 'img2pdf'))
      .filter((x) => files.length === 1 || x.multiple || x.id === 'merge');
    picked.hidden = false;
    picked.replaceChildren(h('h2', null, t(L.pickedT, { n: files.length })), h('p', null, t(L.pickedS)),
      h('div', { class: 'chips' }, fit.map((x) => h('a', { class: 'chip', href: '#/' + x.id }, h('span', { class: 'cic', html: svg(x.icon) }), t(x.name)))));
    picked.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  sheet.addEventListener('click', (e) => { if (e.target !== fileIn) fileIn.click(); });
  sheet.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileIn.click(); } });
  fileIn.addEventListener('change', () => { takeFiles(fileIn.files); fileIn.value = ''; });
  sheet.addEventListener('dragover', (e) => { e.preventDefault(); sheet.classList.add('over'); });
  sheet.addEventListener('dragleave', () => sheet.classList.remove('over'));
  sheet.addEventListener('drop', (e) => { e.preventDefault(); sheet.classList.remove('over'); takeFiles(e.dataTransfer.files); });

  app.replaceChildren(h('div', { class: 'wrap' },
    h('section', { class: 'hero intro' },
      h('div', null,
        h('h1', null, t(L.h1)),
        h('p', { class: 'lede' }, t(L.lede)),
        h('div', { class: 'cta' }, h('button', { class: 'btn primary', type: 'button', onclick: () => fileIn.click() }, t(L.ctaPick)), h('a', { class: 'btn', href: '#tools', onclick: (e) => { e.preventDefault(); document.getElementById('tools').scrollIntoView({ behavior: 'smooth' }); } }, t(L.ctaTools)))),
      sheet),
    picked,
    h('div', { class: 'dir-head', id: 'tools' }, h('div', { class: 'search' }, h('span', { html: svg(I.search) }), input), chips),
    dir,
    demo(),
    h('ul', { class: 'how' }, [[HOW.shield, L.how1], [HOW.offline, L.how2], [HOW.free, L.how3]].map(([ic, s]) =>
      h('li', null, h('span', { html: svg(ic) }), t(s))))));
  document.title = 'PDFDika: ' + t({ id: 'semua alat PDF, langsung di browser', en: 'every PDF tool, right in your browser' });
}

async function renderTool(tool) {
  const cat = catOf(tool.cat);
  const root = h('div', { class: 'wrap' });
  root.append(
    h('a', { class: 'back crumb', href: '#/' }, h('span', { html: svg(I.back), style: { width: '18px', display: 'inline-flex' } }), t(L.back)),
    h('header', { class: 'tool-head', style: `--cat:${cat.color}` },
      h('span', { class: 'ic', html: svg(tool.icon) }),
      h('div', null, h('h1', null, t(tool.name)), h('p', null, t(tool.desc)))));
  app.replaceChildren(root);
  document.title = t(tool.name) + ' · PDFDika';
  if (tool.status === 'soon') {
    root.append(h('section', { class: 'result', style: { marginBottom: '48px' } },
      h('h2', null, t(L.soonT)), h('p', null, t(L.soonP, { name: t(tool.name) })),
      h('a', { class: 'btn', href: '#/' }, t(L.back))));
    return;
  }
  try {
    const mod = await import(`./tools/${tool.module || tool.id}.js`);
    await mod.mount(root, tool);
  } catch (e) { reportError(e); }
}

function route() {
  const id = location.hash.replace(/^#\/?/, '').split(/[?#]/)[0];
  const tool = id && byId(id);
  const go = () => {
    if (tool) renderTool(tool); else renderHome();
    if (id !== 'tools') window.scrollTo({ top: 0 });
    if (id === 'tools') $('#tools')?.scrollIntoView();
  };
  if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches && app.childElementCount) document.startViewTransition(go);
  else go();
}

function chrome() {
  $('#langLabel').textContent = getLang() === 'id' ? 'EN' : 'ID';
  $('#langBtn').setAttribute('aria-label', getLang() === 'id' ? 'Switch to English' : 'Ganti ke Bahasa Indonesia');
  $('#srcLink').textContent = t(L.src);
  $('#installLabel').textContent = t(L.install);
  $('.skip').textContent = t(L.skip);
  $('#year').textContent = new Date().getFullYear();
}

$('#langBtn').addEventListener('click', () => { setLang(getLang() === 'id' ? 'en' : 'id'); chrome(); route(); });
$('#themeBtn').addEventListener('click', () => {
  const root = document.documentElement;
  const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  root.dataset.theme = dark ? 'light' : 'dark';
  LS.set('pdfdika.theme', root.dataset.theme);
});
document.addEventListener('keydown', (e) => {
  if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement.tagName)) {
    const s = $('.search input'); if (s) { e.preventDefault(); s.focus(); }
  }
});

let deferred;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; $('#installBtn').hidden = false; });
$('#installBtn').addEventListener('click', async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice; deferred = null; $('#installBtn').hidden = true; });
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});

window.addEventListener('hashchange', route);
chrome();
route();
