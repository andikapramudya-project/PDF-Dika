// Reflow engine: turns a PDF's positioned text into a reading-order list of blocks.
// Block types: {type:'h', level, runs} | {type:'p', runs} | {type:'hr'} | {type:'img', blob, w, h}
// A run is {t: text, i: italic, b: bold, sup: superscript}.

const median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const pct = (a, p) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };

function mul(m, n) { // 2D affine: m · n  (pdf.js order: [a b c d e f])
  return [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
}

/** Image boxes (viewport coords, top-down) from a page operator list. */
function imageBoxes(ops, OPS, viewport) {
  const boxes = []; let ctm = [1, 0, 0, 1, 0, 0]; const stack = [];
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i], args = ops.argsArray[i];
    if (fn === OPS.save) stack.push(ctm);
    else if (fn === OPS.restore) ctm = stack.pop() || [1, 0, 0, 1, 0, 0];
    else if (fn === OPS.transform) ctm = mul(ctm, args);
    else if (fn === OPS.paintFormXObjectBegin) { stack.push(ctm); if (args?.[0]) ctm = mul(ctm, args[0]); }
    else if (fn === OPS.paintFormXObjectEnd) ctm = stack.pop() || ctm;
    else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject || fn === OPS.paintImageXObjectRepeat || fn === OPS.paintImageMaskXObject) {
      const pts = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([x, y]) => viewport.convertToViewportPoint(ctm[0] * x + ctm[2] * y + ctm[4], ctm[1] * x + ctm[3] * y + ctm[5]));
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      boxes.push({ x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) });
    }
  }
  // merge overlapping boxes (images split into strips)
  const out = [];
  for (const b of boxes.sort((a, c) => a.y0 - c.y0)) {
    const o = out.find((q) => b.x0 < q.x1 + 2 && b.x1 > q.x0 - 2 && b.y0 < q.y1 + 2 && b.y1 > q.y0 - 2);
    if (o) { o.x0 = Math.min(o.x0, b.x0); o.y0 = Math.min(o.y0, b.y0); o.x1 = Math.max(o.x1, b.x1); o.y1 = Math.max(o.y1, b.y1); } else out.push({ ...b });
  }
  return out;
}

/** Find vertical gutters (column gaps) on a page from its text rows. */
function findGutters(items, W) {
  // rows: group by baseline, then coverage per x of each row's merged intervals
  const rows = [];
  for (const it of [...items].sort((a, b) => a.y - b.y)) {
    const r = rows.find((q) => Math.abs(q.y - it.y) < it.size * 0.4);
    if (r) r.items.push(it); else rows.push({ y: it.y, items: [it] });
  }
  if (rows.length < 6) return [];
  const cov = new Uint16Array(Math.ceil(W) + 1);
  for (const r of rows) for (const it of r.items) for (let x = Math.max(0, Math.floor(it.x)); x <= Math.min(W, Math.ceil(it.x + it.w)); x++) cov[x]++;
  // only rows count once per x
  const lim = Math.max(1, rows.length * 0.06);
  const lo = Math.floor(W * 0.18), hi = Math.ceil(W * 0.82);
  // text extent
  const left = pct(items.map((i) => i.x), 0.03), right = pct(items.map((i) => i.x + i.w), 0.97);
  const gutters = [];
  let start = -1;
  for (let x = lo; x <= hi; x++) {
    const empty = cov[x] <= lim;
    if (empty && start < 0) start = x;
    if ((!empty || x === hi) && start >= 0) {
      const end = empty ? x : x - 1;
      if (end - start >= 6 && start > left + 40 && end < right - 40) gutters.push((start + end) / 2);
      start = -1;
    }
  }
  if (!gutters.length) return [];
  // check each side really holds text
  const cols = [left, ...gutters, right];
  for (let i = 0; i < cols.length - 1; i++) {
    const n = items.filter((it) => it.x >= cols[i] - 2 && it.x + it.w <= cols[i + 1] + 2).length;
    if (n < items.length * 0.12) return [];
  }
  return gutters;
}

function lineText(line) { return line.runs.map((r) => r.t).join(''); }

/** Build lines from items of one column, sorted top-down. */
function buildLines(items) {
  const lines = [];
  for (const it of [...items].sort((a, b) => a.y - b.y || a.x - b.x)) {
    let l = lines.find((q) => Math.abs(q.y - it.y) < Math.max(q.size, it.size) * 0.45 || (it.size < q.size * 0.8 && it.y < q.y && q.y - it.y < q.size * 0.7 && it.x >= q.x0 - 2));
    if (!l) { l = { y: it.y, items: [], size: it.size, x0: it.x, x1: it.x + it.w }; lines.push(l); }
    l.items.push(it);
  }
  for (const l of lines) {
    l.items.sort((a, b) => a.x - b.x);
    const sizes = {}; for (const it of l.items) sizes[it.size.toFixed(1)] = (sizes[it.size.toFixed(1)] || 0) + it.str.length;
    l.size = +Object.entries(sizes).sort((a, b) => b[1] - a[1])[0][0];
    l.x0 = l.items[0].x; l.x1 = Math.max(...l.items.map((i) => i.x + i.w));
    l.runs = []; let lastEnd = null;
    const main = l.items.filter((i) => Math.abs(i.size - l.size) < 0.5);
    l.y = main.length ? median(main.map((i) => i.y)) : l.y;
    for (const it of l.items) {
      const sup = it.size < l.size * 0.8 && l.y - it.y > l.size * 0.15;
      let t = it.str;
      if (lastEnd != null && it.x - lastEnd > l.size * 0.18) {
        const prev = l.runs[l.runs.length - 1];
        if (prev && !/\s$/.test(prev.t) && !/^\s/.test(t)) t = ' ' + t;
      }
      const last = l.runs[l.runs.length - 1];
      if (last && last.i === it.italic && last.b === it.bold && last.sup === sup) last.t += t;
      else l.runs.push({ t, i: it.italic, b: it.bold, sup });
      lastEnd = it.x + it.w;
    }
    const chars = l.items.reduce((s, i) => s + i.str.length, 0) || 1;
    l.italic = l.items.reduce((s, i) => s + (i.italic ? i.str.length : 0), 0) / chars > 0.6;
    l.bold = l.items.reduce((s, i) => s + (i.bold ? i.str.length : 0), 0) / chars > 0.6;
    l.text = lineText(l).replace(/\s+/g, ' ').trim();
  }
  return lines.filter((l) => l.text).sort((a, b) => a.y - b.y);
}

/**
 * Read a pdf.js document and return { blocks, title, author, lang, stats }.
 * opts: { images: bool, dropRunning: bool, onProgress(done,total) }
 */
export async function extract(pdf, pdfjsLib, opts = {}) {
  const { images = true, dropRunning = true, onProgress = () => {} } = opts;
  const OPS = pdfjsLib.OPS;
  const pages = [];
  const N = pdf.numPages;

  for (let p = 1; p <= N; p++) {
    const page = await pdf.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    const ops = await page.getOperatorList();
    const tc = await page.getTextContent();
    const fonts = {};
    const fontOf = (id) => {
      if (fonts[id]) return fonts[id];
      let f = null; try { if (page.commonObjs.has(id)) f = page.commonObjs.get(id); } catch { /* not loaded */ }
      const name = (f?.name || tc.styles[id]?.fontFamily || '').toString();
      return (fonts[id] = { italic: !!f?.italic || /italic|oblique|-it\b|kursiv/i.test(name), bold: !!f?.bold || !!f?.black || /bold|black|heavy|semibold|demi/i.test(name) });
    };
    const items = [];
    for (const it of tc.items) {
      if (!it.str || !it.str.trim() && !it.str.length) continue;
      const [a, b, c, d, e, f] = it.transform;
      if (Math.abs(b) > Math.abs(a) * 0.2 || Math.abs(c) > Math.abs(d) * 0.2) continue; // rotated/vertical text
      const size = Math.hypot(c, d) || Math.hypot(a, b);
      if (size < 3) continue;
      const [x, y] = vp.convertToViewportPoint(e, f);
      const ft = fontOf(it.fontName);
      items.push({ str: it.str, x, y, w: it.width, size, italic: ft.italic, bold: ft.bold });
    }
    // images
    let imgs = imageBoxes(ops, OPS, vp);
    const area = vp.width * vp.height;
    const textChars = items.reduce((s, i) => s + i.str.trim().length, 0);
    const scanned = textChars < 40 && imgs.some((b) => (b.x1 - b.x0) * (b.y1 - b.y0) > area * 0.6);
    imgs = imgs.filter((b) => {
      const a = (b.x1 - b.x0) * (b.y1 - b.y0);
      if (scanned) return a > area * 0.6;
      return a > area * 0.012 && a < area * 0.85 && (b.x1 - b.x0) > 24 && (b.y1 - b.y0) > 24;
    });
    if (!images && !scanned) imgs = [];
    // drop text sitting inside figures (labels baked into the picture area)
    const inImg = (it) => imgs.some((b) => it.x + it.w / 2 > b.x0 && it.x + it.w / 2 < b.x1 && it.y > b.y0 && it.y < b.y1 + it.size * 0.3);
    const body = scanned ? [] : items.filter((it) => !inImg(it));
    pages.push({ p, page, vp, items: body, imgs, scanned });
    onProgress(p, N, 'read');
  }

  // ----- running headers / footers -----
  const allLines = [];
  for (const pg of pages) {
    const W = pg.vp.width, H = pg.vp.height;
    const gutters = findGutters(pg.items, W);
    const bounds = [-Infinity, ...gutters, Infinity];
    const colOf = (x0, x1) => { for (let i = 0; i < bounds.length - 1; i++) if (x0 >= bounds[i] - 3 && x1 <= bounds[i + 1] + 3) return i; return -1; };
    const byCol = new Map();
    for (const it of pg.items) {
      const c = gutters.length ? colOf(it.x, it.x + it.w) : 0;
      if (!byCol.has(c)) byCol.set(c, []);
      byCol.get(c).push(it);
    }
    // spanning items (c=-1) are rebuilt as lines; they split the page into bands
    const span = buildLines(byCol.get(-1) || []).map((l) => ({ ...l, col: -1 }));
    const colLines = [...byCol.keys()].filter((k) => k >= 0).sort((a, b) => a - b).map((k) => buildLines(byCol.get(k)).map((l) => ({ ...l, col: k })));
    const imgLines = pg.imgs.map((b) => ({ type: 'img', box: b, y: b.y0, col: gutters.length ? colOf(b.x0, b.x1) : 0, page: pg }));
    // reading order: band by band; inside a band column by column
    const cuts = [...span.map((l) => l.y), ...imgLines.filter((l) => l.col === -1).map((l) => l.y)].sort((a, b) => a - b);
    const bandOf = (y) => { let i = 0; while (i < cuts.length && y > cuts[i] + 0.5) i++; return i; };
    const ordered = [];
    const nb = cuts.length + 1;
    for (let band = 0; band < nb; band++) {
      for (let c = 0; c < Math.max(colLines.length, 1); c++) {
        const ls = [...(colLines[c] || []), ...imgLines.filter((l) => l.col === c)].filter((l) => bandOf(l.y) === band).sort((a, b) => a.y - b.y);
        ordered.push(...ls);
      }
      if (band < cuts.length) ordered.push(...[...span, ...imgLines.filter((l) => l.col === -1)].filter((l) => Math.abs(l.y - cuts[band]) < 0.5));
    }
    // column bounds for paragraph heuristics
    const colBounds = {};
    for (const l of ordered) if (!l.type) {
      (colBounds[l.col] ||= { x0: [], x1: [] }).x0.push(l.x0); colBounds[l.col].x1.push(l.x1);
    }
    for (const k in colBounds) colBounds[k] = { left: pct(colBounds[k].x0, 0.15), right: pct(colBounds[k].x1, 0.85) };
    for (const l of ordered) { l.page = pg; l.H = H; l.W = W; if (!l.type) l.cb = colBounds[l.col]; allLines.push(l); }
  }

  const keyOf = (t) => t.toLowerCase().replace(/\d+/g, '#').replace(/\s+/g, ' ').trim();
  const pageNum = /^((halaman|page|hal\.?)\s*)?[-–—(]*\s*[\divxlcdm]{1,5}\s*[-–—)]*(\s*(\/|of|dari)\s*\d+)?$/i;
  if (dropRunning) {
    // only the outermost lines of a page can be running headers or footers
    const outer = new Set();
    const byPage = new Map();
    for (const l of allLines) if (!l.type) { if (!byPage.has(l.page)) byPage.set(l.page, []); byPage.get(l.page).push(l); }
    for (const ls of byPage.values()) { ls.sort((a, b) => a.y - b.y); [ls[0], ls[1], ls[ls.length - 1], ls[ls.length - 2]].forEach((x) => x && outer.add(x)); }
    const edge = (l) => outer.has(l) && (l.y < l.H * 0.1 || l.y > l.H * 0.9);
    const counts = {};
    for (const l of allLines) if (!l.type && edge(l)) { const k = keyOf(l.text); (counts[k] ||= new Set()).add(l.page.p); }
    const minRep = N <= 3 ? N : Math.max(3, Math.round(N * 0.2));
    for (const l of allLines) if (!l.type && edge(l) && (pageNum.test(l.text) || counts[keyOf(l.text)]?.size >= minRep)) l.drop = true;
  }
  const lines = allLines.filter((l) => !l.drop);

  // ----- typography stats -----
  const textLines = lines.filter((l) => !l.type);
  const sizeChars = {};
  for (const l of textLines) sizeChars[l.size.toFixed(1)] = (sizeChars[l.size.toFixed(1)] || 0) + l.text.length;
  const body = +(Object.entries(sizeChars).sort((a, b) => b[1] - a[1])[0]?.[0] || 10);
  const gaps = [];
  for (let i = 1; i < textLines.length; i++) {
    const a = textLines[i - 1], b = textLines[i];
    if (a.page === b.page && a.col === b.col && Math.abs(a.size - body) < 0.6 && Math.abs(b.size - body) < 0.6 && b.y > a.y) gaps.push(b.y - a.y);
  }
  const lineGap = median(gaps.filter((g) => g < body * 3)) || body * 1.3;
  const headSizes = [...new Set(textLines.filter((l) => l.size >= body * 1.18 && l.text.length < 160).map((l) => Math.round(l.size)))].sort((a, b) => b - a);
  const levelOf = (s) => Math.min(3, headSizes.indexOf(Math.round(s)) + 1) || 3;

  // ----- blocks -----
  const blocks = [];
  let cur = null, prev = null;
  const endsSentence = (t) => /[.!?:;"”’»)\]]$/.test(t);
  const push = (b) => { blocks.push(b); return b; };
  const appendRuns = (blk, runs, joinHyphen, sep = ' ') => {
    const last = blk.runs[blk.runs.length - 1];
    let first = runs.map((r) => ({ ...r }));
    if (last) {
      const lt = last.t.replace(/\s+$/, '');
      const ft = first[0].t.replace(/^\s+/, '');
      if (joinHyphen) {
        const m = lt.match(/([\p{L}]+)([-\u2010\u2011\u00AD])$/u) || [];
        const frag = (m[1] || '').toLowerCase(), mark = m[2];
        const next = ((ft.match(/^([\p{L}]+)/u) || [])[1] || '').toLowerCase();
        // A real hyphen before a repeated word is Indonesian reduplication: "siapa-siapa", "berpura-pura", "sehari-hari".
        const redup = mark === '-' && frag && next.length >= 2 && (frag === next || frag.endsWith(next));
        last.t = redup ? lt.slice(0, -1) + '-' : lt.slice(0, -1);
        first[0].t = ft;
      } else if (/[­]$/.test(lt)) { last.t = lt.slice(0, -1); first[0].t = ft; }
      else { last.t = lt; first[0].t = sep + ft; }
    }
    for (const r of first) {
      const l2 = blk.runs[blk.runs.length - 1];
      if (l2 && l2.i === r.i && l2.b === r.b && l2.sup === r.sup) l2.t += r.t; else blk.runs.push(r);
    }
  };

  for (const l of lines) {
    if (l.type === 'img') { cur = null; push({ type: 'img', box: l.box, page: l.page }); prev = null; continue; }
    const t = l.text;
    if (/^[*•·~\-–—_#\s]{3,}$/.test(t) || /^(\*\s*){3}$/.test(t) || t === '#' || t === '***') { cur = null; push({ type: 'hr' }); prev = l; continue; }
    const isHead = l.size >= body * 1.18 && t.length < 160 && !/[.,;]$/.test(t);
    const isBoldHead = !isHead && l.bold && t.length < 90 && Math.abs(l.size - body) < 1.2 && !endsSentence(t) && (!prev || prev.page !== l.page || l.y - prev.y > lineGap * 1.4) && /^\p{Lu}|^\d/u.test(t);
    if (isHead || isBoldHead) {
      const level = isHead ? levelOf(l.size) : 3;
      if (cur?.type === 'h' && cur.level === level && prev && prev.page === l.page && l.y - prev.y < l.size * 1.9) appendRuns(cur, l.runs.map((r) => ({ ...r, b: false })), false, '\n');
      else cur = push({ type: 'h', level, runs: l.runs.map((r) => ({ ...r, b: false })) });
      prev = l; continue;
    }
    let newPara = !cur || cur.type !== 'p';
    if (!newPara && prev) {
      const pt = prev.text;
      const hyph = /[\p{L}][-\u2010\u2011\u00AD]$/u.test(pt) && /^[\p{Ll}]/u.test(t);
      const sameFlow = prev.page === l.page && prev.col === l.col;
      const cb = l.cb || { left: l.x0, right: l.x1 };
      const indent = l.x0 > cb.left + body * 0.8 && l.x0 < cb.left + body * 4;
      const shortPrev = prev.cb && prev.x1 < prev.cb.right - body * 2.5;
      if (hyph) { appendRuns(cur, l.runs, true); prev = l; continue; }
      if (sameFlow && l.y - prev.y > lineGap * 1.45) newPara = true;
      else if (indent && !(prev.x0 > cb.left + body * 0.8)) newPara = true;
      else if (shortPrev && endsSentence(pt)) newPara = true;
      else if (Math.abs(l.size - prev.size) > 1.2) newPara = true;
      else if (l.italic !== prev.italic && sameFlow && endsSentence(pt)) newPara = true;
    }
    if (newPara) cur = push({ type: 'p', runs: l.runs.map((r) => ({ ...r, t: r.t })) });
    else appendRuns(cur, l.runs, false);
    prev = l;
  }
  for (const b of blocks) if (b.runs) { b.runs.forEach((r) => (r.t = r.t.replace(/[^\S\n]+/g, ' '))); b.runs[0].t = b.runs[0].t.trimStart(); b.runs[b.runs.length - 1].t = b.runs[b.runs.length - 1].t.trimEnd(); b.runs = b.runs.filter((r) => r.t); }
  const clean = blocks.filter((b) => b.type === 'img' || b.type === 'hr' || b.runs?.length);
  // a paragraph that is wholly italic stays italic; mark it for nicer styling (epigraphs)
  for (const b of clean) if (b.type === 'p' && b.runs.every((r) => r.i || !r.t.trim())) b.quote = true;

  // ----- crop images -----
  const withImg = [...new Set(clean.filter((b) => b.type === 'img').map((b) => b.page))];
  let done = 0;
  for (const pg of withImg) {
    const scale = Math.min(2, 2400 / pg.vp.width);
    const v = pg.page.getViewport({ scale });
    const c = document.createElement('canvas'); c.width = Math.ceil(v.width); c.height = Math.ceil(v.height);
    await pg.page.render({ canvasContext: c.getContext('2d'), viewport: v }).promise;
    for (const b of clean.filter((x) => x.type === 'img' && x.page === pg)) {
      const { x0, y0, x1, y1 } = b.box;
      const w = Math.max(1, Math.round((x1 - x0) * scale)), h = Math.max(1, Math.round((y1 - y0) * scale));
      const o = document.createElement('canvas'); o.width = w; o.height = h;
      const g = o.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
      g.drawImage(c, Math.round(x0 * scale), Math.round(y0 * scale), w, h, 0, 0, w, h);
      b.blob = await new Promise((r) => o.toBlob(r, 'image/jpeg', 0.86));
      b.w = w; b.h = h; delete b.box; delete b.page;
    }
    onProgress(++done, withImg.length, 'images');
  }
  for (const b of clean) if (b.type === 'img') delete b.page;

  const meta = await pdf.getMetadata().catch(() => ({}));
  const sample = clean.filter((b) => b.type === 'p').slice(0, 60).map((b) => b.runs.map((r) => r.t).join('')).join(' ').toLowerCase();
  const idHits = (sample.match(/\b(yang|dan|di|itu|dengan|tidak|untuk|ini|dari|aku|kau)\b/g) || []).length;
  const enHits = (sample.match(/\b(the|and|of|to|is|that|with|for|was|it)\b/g) || []).length;
  return {
    blocks: clean,
    title: (meta.info?.Title || '').trim(),
    author: (meta.info?.Author || '').trim(),
    lang: idHits >= enHits ? 'id' : 'en',
    stats: { pages: N, scanned: pages.filter((p) => p.scanned).length, body },
  };
}

/** Split blocks into chapters at the top heading level actually used. */
export function chapters(blocks, title) {
  const levels = blocks.filter((b) => b.type === 'h').map((b) => b.level);
  const top = levels.length ? Math.min(...levels) : 0;
  const out = [];
  let ch = null;
  for (const b of blocks) {
    if (b.type === 'h' && b.level === top && (!ch || ch.blocks.length)) { ch = { title: b.runs.map((r) => r.t).join('').replace(/\s*\n\s*/g, ' '), blocks: [] }; out.push(ch); }
    if (!ch) { ch = { title: title || 'Awal', blocks: [] }; out.push(ch); }
    ch.blocks.push(b);
  }
  // very long chapter-less books: cut every ~60 blocks so e-readers stay fast
  if (out.length === 1 && out[0].blocks.length > 120) {
    const all = out[0].blocks; out.length = 0;
    for (let i = 0; i < all.length; i += 60) out.push({ title: `${title || 'Bagian'} ${i / 60 + 1}`, blocks: all.slice(i, i + 60) });
  }
  return out;
}
