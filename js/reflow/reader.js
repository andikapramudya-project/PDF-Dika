// Self-contained reading view. buildReaderHTML() returns one HTML file that works offline,
// with its own CSS and script inline. The same file is shown inside PDFDika as a preview.

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function runsToHTML(runs, quote) {
  return runs.map((r0) => {
    const r = quote ? { ...r0, i: !r0.i } : r0; // quote paragraphs are italic by CSS; inner italics flip back
    let s = esc(r.t).replace(/\n/g, '<br>');
    if (r.sup) s = `<sup>${s}</sup>`;
    if (r.b) s = `<strong>${s}</strong>`;
    if (r.i) s = `<em>${s}</em>`;
    return s;
  }).join('');
}

/** Heading as one line: "Bab 1\nJudul" becomes "Bab 1: Judul". */
export function headingText(b) {
  const parts = b.runs.map((r) => r.t).join('').split('\n').map((x) => x.trim()).filter(Boolean);
  if (parts.length > 1 && /^(bab|chapter|bagian|part|buku|book)\s+[\w.]+$/i.test(parts[0])) return parts[0] + ': ' + parts.slice(1).join(' ');
  return parts.join(' ');
}

export function blobToDataURL(blob) {
  return new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
}

const UI = {
  id: { toc: 'Daftar isi', smaller: 'Perkecil huruf', bigger: 'Perbesar huruf', settings: 'Pengaturan tampilan', font: 'Huruf', serif: 'Serif', sans: 'Sans', spacing: 'Jarak baris', width: 'Lebar teks', narrow: 'Sempit', medium: 'Sedang', wide: 'Lebar', align: 'Perataan', left: 'Kiri', justify: 'Rata', para: 'Paragraf', gap: 'Berjarak', indent: 'Menjorok', theme: 'Tema', auto: 'Otomatis', light: 'Terang', sepia: 'Sepia', dark: 'Gelap', black: 'Hitam', close: 'Tutup', made: 'Dibuat dengan PDFDika, langsung di perangkatmu.', top: 'Ke awal' },
  en: { toc: 'Contents', smaller: 'Smaller text', bigger: 'Larger text', settings: 'Display settings', font: 'Font', serif: 'Serif', sans: 'Sans', spacing: 'Line spacing', width: 'Text width', narrow: 'Narrow', medium: 'Medium', wide: 'Wide', align: 'Alignment', left: 'Left', justify: 'Justify', para: 'Paragraphs', gap: 'Spaced', indent: 'Indented', theme: 'Theme', auto: 'Auto', light: 'Light', sepia: 'Sepia', dark: 'Dark', black: 'Black', close: 'Close', made: 'Made with PDFDika, right on your device.', top: 'Back to start' },
};

const CSS = `
:root{--size:19px;--lh:1.7;--measure:34em;--bg:#fff;--ink:#1e1f24;--soft:#6b6f7b;--line:#e4e5ea;--bar:#ffffffee;--accent:#2346E0;--img:none;
--serif:"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua","Noto Serif",Georgia,serif;--sans:system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans",sans-serif;--font:var(--serif)}
:root[data-theme=sepia]{--bg:#f3ead7;--ink:#45361f;--soft:#8a7556;--line:#e0d3b8;--bar:#f3ead7ee;--accent:#9a4a12}
:root[data-theme=dark]{--bg:#17191e;--ink:#dcd8cf;--soft:#8d919c;--line:#2a2d35;--bar:#17191eee;--accent:#8fa2ff;--img:brightness(.88)}
:root[data-theme=black]{--bg:#000;--ink:#c9c9c9;--soft:#7d7d7d;--line:#1e1e1e;--bar:#000000ee;--accent:#8fa2ff;--img:brightness(.8)}
@media (prefers-color-scheme:dark){:root[data-theme=auto]{--bg:#17191e;--ink:#dcd8cf;--soft:#8d919c;--line:#2a2d35;--bar:#17191eee;--accent:#8fa2ff;--img:brightness(.88)}}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%;scroll-padding-top:72px}
body{margin:0;background:var(--bg);color:var(--ink);font:400 var(--size)/var(--lh) var(--font);transition:background-color .3s,color .3s;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
.bar{position:fixed;inset:0 0 auto 0;z-index:5;background:var(--bar);border-bottom:1px solid var(--line);transition:transform .3s cubic-bezier(.2,.7,.2,1);font:500 15px/1 var(--sans)}
.bar.hide{transform:translateY(-100%)}
.bar-in{max-width:980px;margin:0 auto;display:flex;align-items:center;gap:6px;padding:8px 12px}
.bar button{font:inherit;color:var(--ink);background:transparent;border:1px solid var(--line);border-radius:10px;height:40px;min-width:44px;padding:0 12px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:8px}
.bar button:hover{border-color:var(--soft)}.bar button svg{width:18px;height:18px}
.where{flex:1;min-width:0;color:var(--soft);overflow:hidden;white-space:nowrap;text-overflow:ellipsis;padding:0 6px;font-size:14px}
.prog{position:absolute;left:0;bottom:-1px;height:2px;background:var(--accent);width:0;transition:width .15s linear}
main{max-width:var(--measure);margin:0 auto;padding:88px 22px 30vh}
h1,h2,h3{font-family:var(--font);line-height:1.2;font-weight:700;margin:2.2em 0 .7em;text-wrap:balance}
h1{font-size:1.75em;letter-spacing:-.01em}h2{font-size:1.35em}h3{font-size:1.1em}
main>section:first-child>h1:first-child,main>section:first-child>h2:first-child{margin-top:.4em}
section+section{margin-top:3.5em}
p{margin:0 0 1em;hyphens:auto;-webkit-hyphens:auto;overflow-wrap:break-word;text-align:var(--align,left)}
:root[data-para=indent] p{margin:0}:root[data-para=indent] p+p{text-indent:1.6em}
p.q{font-style:italic;color:color-mix(in srgb,var(--ink) 85%,var(--bg))}
sup{font-size:.65em;line-height:0}
hr{border:0;margin:2.2em auto;text-align:center;color:var(--soft)}hr::after{content:"⁂";font-size:1.1em;letter-spacing:.4em}
figure{margin:1.6em 0;text-align:center}figure img{max-width:100%;height:auto;border-radius:4px;filter:var(--img)}
.end{margin-top:4em;padding-top:1.4em;border-top:1px solid var(--line);color:var(--soft);font:14px/1.5 var(--sans);text-align:center}
.end button{margin-top:10px;font:inherit;color:var(--accent);background:none;border:0;cursor:pointer;text-decoration:underline}
.scrim{position:fixed;inset:0;background:#0006;z-index:8;opacity:0;pointer-events:none;transition:opacity .25s}
.scrim.on{opacity:1;pointer-events:auto}
.drawer{position:fixed;z-index:9;top:0;bottom:0;left:0;width:min(360px,88vw);background:var(--bg);border-right:1px solid var(--line);transform:translateX(-102%);transition:transform .3s cubic-bezier(.2,.7,.2,1);display:flex;flex-direction:column;font:15px/1.4 var(--sans)}
.drawer.on{transform:none}
.drawer header{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid var(--line);font-weight:650}
.drawer header button,.sheet header button{font:inherit;color:var(--soft);background:none;border:0;cursor:pointer;padding:6px}
.toc{overflow:auto;padding:8px 0;margin:0;list-style:none}
.toc a{display:block;padding:10px 18px;color:var(--ink);text-decoration:none;border-left:3px solid transparent}
.toc a.l2{padding-left:34px;color:var(--soft)}.toc a.l3{padding-left:48px;color:var(--soft);font-size:14px}
.toc a.on{border-left-color:var(--accent);color:var(--accent);font-weight:600}
.toc a:hover{background:color-mix(in srgb,var(--ink) 6%,transparent)}
.sheet{position:fixed;z-index:9;left:50%;bottom:0;width:min(520px,100%);transform:translate(-50%,104%);background:var(--bg);border:1px solid var(--line);border-bottom:0;border-radius:18px 18px 0 0;padding:6px 18px calc(18px + env(safe-area-inset-bottom));transition:transform .3s cubic-bezier(.2,.7,.2,1);font:15px/1.3 var(--sans)}
.sheet.on{transform:translate(-50%,0)}
.sheet header{display:flex;justify-content:space-between;align-items:center;font-weight:650;padding:10px 0}
.opt{display:grid;grid-template-columns:96px 1fr;align-items:center;gap:10px;padding:8px 0}
.opt>span{color:var(--soft);font-size:14px}
.seg{display:flex;gap:4px;padding:3px;border:1px solid var(--line);border-radius:12px}
.seg button{flex:1;height:36px;border:0;border-radius:9px;background:none;color:var(--ink);font:500 14px var(--sans);cursor:pointer}
.seg button[aria-pressed=true]{background:var(--ink);color:var(--bg)}
.sw{display:flex;gap:8px}.sw button{width:40px;height:40px;border-radius:50%;border:2px solid var(--line);cursor:pointer}
.sw button[aria-pressed=true]{outline:3px solid var(--accent);outline-offset:2px}
:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
@media (max-width:560px){.bar .lbl{display:none}main{padding:76px 18px 30vh}}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
@media print{.bar,.drawer,.sheet,.scrim,.end{display:none}main{padding:0;max-width:none}body{background:#fff;color:#000}}
`;

// The script is stringified into the exported file; keep it dependency-free.
function readerScript(T, bookId) {
  const KEY = 'pdfdika-reader', POS = 'pdfdika-pos:' + bookId;
  const store = { get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  const S = Object.assign({ size: 19, font: 'serif', lh: 1.7, width: 'm', align: 'left', theme: 'auto', para: 'gap' }, store.get(KEY) || {});
  const R = document.documentElement;
  const $ = (s) => document.querySelector(s);
  function apply() {
    R.style.setProperty('--size', S.size + 'px');
    R.style.setProperty('--lh', S.lh);
    R.style.setProperty('--font', S.font === 'sans' ? 'var(--sans)' : 'var(--serif)');
    R.style.setProperty('--measure', { s: '28em', m: '34em', l: '42em' }[S.width]);
    R.style.setProperty('--align', S.align);
    R.dataset.theme = S.theme; R.dataset.para = S.para;
    store.set(KEY, S);
    document.querySelectorAll('[data-k]').forEach((b) => b.setAttribute('aria-pressed', String(String(S[b.dataset.k]) === b.dataset.v)));
  }
  const keep = (fn) => { const anchor = ratio(); fn(); apply(); requestAnimationFrame(() => scrollTo(0, anchor * maxY())); };
  const maxY = () => Math.max(1, document.documentElement.scrollHeight - innerHeight);
  const ratio = () => scrollY / maxY();
  $('#smaller').onclick = () => keep(() => (S.size = Math.max(13, S.size - 1)));
  $('#bigger').onclick = () => keep(() => (S.size = Math.min(34, S.size + 1)));
  document.querySelectorAll('[data-k]').forEach((b) => (b.onclick = () => keep(() => { const v = b.dataset.v; S[b.dataset.k] = isNaN(+v) ? v : +v; })));

  const scrim = $('.scrim'), drawer = $('.drawer'), sheet = $('.sheet');
  let lastFocus = null;
  const open = (el) => { lastFocus = document.activeElement; el.classList.add('on'); scrim.classList.add('on'); el.querySelector('button,a')?.focus(); };
  const close = () => { drawer.classList.remove('on'); sheet.classList.remove('on'); scrim.classList.remove('on'); lastFocus?.focus?.(); };
  $('#tocBtn').onclick = () => open(drawer);
  $('#setBtn').onclick = () => open(sheet);
  scrim.onclick = close;
  document.querySelectorAll('.x').forEach((b) => (b.onclick = close));
  addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  document.querySelectorAll('.toc a').forEach((a) => a.addEventListener('click', () => setTimeout(close, 50)));
  $('#toTop') && ($('#toTop').onclick = () => scrollTo({ top: 0, behavior: 'smooth' }));

  // Progress, current chapter, auto-hiding bar
  const heads = [...document.querySelectorAll('main h1[id],main h2[id],main h3[id]')];
  const links = new Map([...document.querySelectorAll('.toc a')].map((a) => [a.getAttribute('href').slice(1), a]));
  const bar = $('.bar'), prog = $('.prog'), where = $('.where');
  let lastY = scrollY, ticking = false, saveT;
  function onScroll() {
    const y = scrollY;
    prog.style.width = (ratio() * 100).toFixed(2) + '%';
    if (y > lastY + 6 && y > 120 && !drawer.classList.contains('on')) bar.classList.add('hide');
    else if (y < lastY - 6) bar.classList.remove('hide');
    lastY = y;
    let cur = null; for (const h of heads) { if (h.getBoundingClientRect().top < 90) cur = h; else break; }
    where.textContent = cur ? (cur.dataset.t || cur.textContent) : document.title;
    links.forEach((a) => a.classList.remove('on')); if (cur && links.get(cur.id)) links.get(cur.id).classList.add('on');
    clearTimeout(saveT); saveT = setTimeout(() => store.set(POS, ratio()), 300);
    ticking = false;
  }
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  // Tap the page (not a link or control) to show or hide the bar
  $('main').addEventListener('click', (e) => { if (!e.target.closest('a,button') && !getSelection().toString()) bar.classList.toggle('hide'); });
  apply();
  const saved = store.get(POS);
  const restore = () => { if (saved > 0.002) scrollTo(0, saved * maxY()); onScroll(); };
  if (document.readyState === 'complete') restore(); else addEventListener('load', restore);
}

const ICON = {
  toc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
  aa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 19l5-13 5 13M5 14h6"/><path d="M15 19v-3.5a2.5 2.5 0 0 1 5 0V19M15 17h5"/></svg>',
};

/** book: { title, author, lang, chapters:[{title, blocks}] }, images resolved via imgSrc(block) */
export async function buildReaderHTML(book, { uiLang = 'id', imgSrc }) {
  const T = UI[uiLang] || UI.id;
  let hid = 0; const toc = [];
  const parts = [];
  for (const ch of book.chapters) {
    const html = [];
    for (const b of ch.blocks) {
      if (b.type === 'h') { const id = 'h' + (++hid); toc.push({ id, level: b.level, text: headingText(b) }); html.push(`<h${b.level} id="${id}" data-t="${esc(headingText(b))}">${runsToHTML(b.runs)}</h${b.level}>`); }
      else if (b.type === 'p') html.push(`<p${b.quote ? ' class="q"' : ''}>${runsToHTML(b.runs, b.quote)}</p>`);
      else if (b.type === 'hr') html.push('<hr>');
      else if (b.type === 'img') html.push(`<figure><img src="${await imgSrc(b)}" width="${b.w}" height="${b.h}" alt="" loading="lazy"></figure>`);
    }
    parts.push(`<section>${html.join('\n')}</section>`);
  }
  const levels = [...new Set(toc.map((t) => t.level))].sort();
  const tocHTML = toc.filter((t) => levels.indexOf(t.level) < 2).map((t) => `<li><a class="l${levels.indexOf(t.level) + 1}" href="#${t.id}">${esc(t.text)}</a></li>`).join('');
  const bookId = (book.title || 'buku') + ':' + book.chapters.reduce((n, c) => n + c.blocks.length, 0);
  const seg = (k, opts) => `<div class="seg" role="group">${opts.map(([v, l]) => `<button type="button" data-k="${k}" data-v="${v}">${esc(l)}</button>`).join('')}</div>`;
  const sw = (opts) => `<div class="sw" role="group">${opts.map(([v, l, bg]) => `<button type="button" data-k="theme" data-v="${v}" title="${esc(l)}" aria-label="${esc(l)}" style="background:${bg}"></button>`).join('')}</div>`;
  return `<!doctype html>
<html lang="${book.lang || 'id'}" data-theme="auto">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="generator" content="PDFDika">
<title>${esc(book.title || 'Buku')}</title>
<style>${CSS}</style>
</head>
<body>
<div class="bar"><div class="bar-in">
<button type="button" id="tocBtn" aria-label="${T.toc}">${ICON.toc}<span class="lbl">${T.toc}</span></button>
<span class="where">${esc(book.title || '')}</span>
<button type="button" id="smaller" aria-label="${T.smaller}">A−</button>
<button type="button" id="bigger" aria-label="${T.bigger}">A+</button>
<button type="button" id="setBtn" aria-label="${T.settings}">${ICON.aa}</button>
</div><div class="prog"></div></div>
<main>
${parts.join('\n')}
<div class="end"><div>${esc(book.title || '')}${book.author ? ', ' + esc(book.author) : ''}</div><div>${T.made}</div><button type="button" id="toTop">${T.top}</button></div>
</main>
<div class="scrim"></div>
<nav class="drawer" aria-label="${T.toc}"><header>${T.toc}<button type="button" class="x" aria-label="${T.close}">✕</button></header><ol class="toc">${tocHTML || `<li><a href="#" class="l1">${esc(book.title || '')}</a></li>`}</ol></nav>
<div class="sheet" role="dialog" aria-label="${T.settings}"><header>${T.settings}<button type="button" class="x" aria-label="${T.close}">✕</button></header>
<div class="opt"><span>${T.theme}</span>${sw([['auto', T.auto, 'linear-gradient(135deg,#fff 50%,#17191e 50%)'], ['light', T.light, '#fff'], ['sepia', T.sepia, '#f3ead7'], ['dark', T.dark, '#17191e'], ['black', T.black, '#000']])}</div>
<div class="opt"><span>${T.font}</span>${seg('font', [['serif', T.serif], ['sans', T.sans]])}</div>
<div class="opt"><span>${T.spacing}</span>${seg('lh', [['1.5', '1.5'], ['1.7', '1.7'], ['1.9', '1.9']])}</div>
<div class="opt"><span>${T.width}</span>${seg('width', [['s', T.narrow], ['m', T.medium], ['l', T.wide]])}</div>
<div class="opt"><span>${T.align}</span>${seg('align', [['left', T.left], ['justify', T.justify]])}</div>
<div class="opt"><span>${T.para}</span>${seg('para', [['gap', T.gap], ['indent', T.indent]])}</div>
</div>
<script>(${readerScript.toString()})(${JSON.stringify(T)}, ${JSON.stringify(bookId)});</script>
</body>
</html>`;
}
