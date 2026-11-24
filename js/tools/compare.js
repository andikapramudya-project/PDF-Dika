import { h, t, svg, I, stem, readBytes, openPreview, download, reportError, toast } from '../core.js';
import { shell, dropzone, takeHandoff } from '../ui.js';

/** Words of a PDF with the page each one is on. */
async function words(pdf) {
  const out = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const tc = await (await pdf.getPage(i)).getTextContent();
    const text = tc.items.map((it) => (it.str || '') + (it.hasEOL ? '\n' : ' ')).join('');
    for (const w of text.replace(/(\p{L})[-­]\s*\n\s*(\p{Ll})/gu, '$1$2').split(/\s+/)) if (w) out.push({ w, p: i });
  }
  return out;
}

/** Myers diff. Returns [{op:'=', '-', '+', a:[], b:[]}] or null when the texts differ too much. */
function diff(A, B, maxD = 4000) {
  let pre = 0; while (pre < A.length && pre < B.length && A[pre].w === B[pre].w) pre++;
  let suf = 0; while (suf < A.length - pre && suf < B.length - pre && A[A.length - 1 - suf].w === B[B.length - 1 - suf].w) suf++;
  const a = A.slice(pre, A.length - suf), b = B.slice(pre, B.length - suf);
  const N = a.length, M = b.length, max = N + M, off = max + 1;
  const trace = [];
  let v = new Int32Array(2 * max + 3); let found = -1;
  for (let d = 0; d <= Math.min(max, maxD); d++) {
    trace.push(v.slice(off - d - 1, off + d + 2));
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && v[off + k - 1] < v[off + k + 1]) ? v[off + k + 1] : v[off + k - 1] + 1;
      let y = x - k;
      while (x < N && y < M && a[x].w === b[y].w) { x++; y++; }
      v[off + k] = x;
      if (x >= N && y >= M) { found = d; break; }
    }
    if (found >= 0) break;
  }
  if (found < 0) return null;
  // walk back
  const edits = [];
  let x = N, y = M;
  for (let d = found; d > 0; d--) {
    const tv = trace[d]; const at = (k) => tv[k + d + 1]; // trace[d] holds v before step d, offset by d+1
    const k = x - y;
    const prevK = k === -d || (k !== d && at(k - 1) < at(k + 1)) ? k + 1 : k - 1;
    const px = at(prevK), py = px - prevK;
    while (x > px && y > py) { edits.push(['=', x - 1, y - 1]); x--; y--; }
    if (x === px) edits.push(['+', -1, y - 1]); else edits.push(['-', x - 1, -1]);
    x = px; y = py;
  }
  while (x > 0 && y > 0) { edits.push(['=', x - 1, y - 1]); x--; y--; }
  edits.reverse();
  const ops = [];
  const push = (op, wa, wb) => { const last = ops[ops.length - 1]; if (last && last.op === op) { wa && last.a.push(wa); wb && last.b.push(wb); } else ops.push({ op, a: wa ? [wa] : [], b: wb ? [wb] : [] }); };
  for (let i = 0; i < pre; i++) push('=', A[i], B[i]);
  for (const [op, i, j] of edits) push(op, i >= 0 ? a[i] : null, j >= 0 ? b[j] : null);
  for (let i = 0; i < suf; i++) push('=', A[A.length - suf + i], B[B.length - suf + i]);
  return ops;
}

function render(ops, names) {
  const wrap = h('div', { class: 'diff' });
  const CONTEXT = 14;
  ops.forEach((o, i) => {
    if (o.op === '=') {
      const ws = o.a.map((x) => x.w);
      if (ws.length > CONTEXT * 2 + 4) {
        if (i > 0) wrap.append(ws.slice(0, CONTEXT).join(' ') + ' ');
        wrap.append(h('span', { class: 'gap' }, '…'));
        if (i < ops.length - 1) { const p = o.b[ws.length - CONTEXT]?.p; wrap.append(h('span', { class: 'pg' }, t({ id: 'hal. {p}', en: 'p. {p}' }, { p })), ws.slice(-CONTEXT).join(' ') + ' '); }
      } else wrap.append(ws.join(' ') + ' ');
    } else if (o.op === '-') wrap.append(h('del', { title: names[0] + ', ' + t({ id: 'hal. {p}', en: 'p. {p}' }, { p: o.a[0].p }) }, o.a.map((x) => x.w).join(' ')), ' ');
    else wrap.append(h('ins', { title: names[1] + ', ' + t({ id: 'hal. {p}', en: 'p. {p}' }, { p: o.b[0].p }) }, o.b.map((x) => x.w).join(' ')), ' ');
  });
  return wrap;
}

function report(el, names, summary) {
  return `<!doctype html><html lang="${document.documentElement.lang}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${names.join(' vs ')}</title>
<style>body{font:16px/1.7 system-ui,sans-serif;max-width:780px;margin:32px auto;padding:0 16px;color:#131B3A}h1{font-size:1.3rem}del{background:#FFE1E6;color:#9B1C3A}ins{background:#DDF5E8;color:#0D6B3F;text-decoration:none}.gap{display:block;color:#888;text-align:center}.pg{display:inline-block;font-size:.78rem;color:#666;border:1px solid #ccc;border-radius:6px;padding:0 6px;margin-right:6px}</style>
<h1>${names.map((n) => n.replace(/[<&]/g, '')).join(' → ')}</h1><p>${summary}</p>${el.outerHTML}</html>`;
}

export async function mount(root, tool) {
  const docs = [null, null];
  const slots = [0, 1].map((i) => {
    const box = h('div', { class: 'cmp-slot' });
    const show = () => {
      if (!docs[i]) {
        box.replaceChildren(h('p', { class: 'lbl' }, i ? t({ id: 'Versi baru', en: 'New version' }) : t({ id: 'Versi lama', en: 'Old version' })),
          dropzone({ accept: tool.accept, compact: true, label: t({ id: 'Pilih PDF', en: 'Choose PDF' }), onFiles: (f) => load(i, f[0]) }));
      } else {
        box.replaceChildren(h('p', { class: 'lbl' }, i ? t({ id: 'Versi baru', en: 'New version' }) : t({ id: 'Versi lama', en: 'Old version' })),
          h('div', { class: 'cmp-file' }, h('span', { html: svg(I.file) }), h('b', null, docs[i].file.name),
            h('button', { class: 'mini', type: 'button', 'aria-label': t({ id: 'Ganti', en: 'Change' }), html: svg(I.x), onclick: () => { docs[i] = null; show(); ready(); } })));
      }
    };
    box.show = show; show();
    return box;
  });
  const out = h('div');
  const ui = shell(root, {
    actionLabel: t({ id: 'Bandingkan', en: 'Compare' }),
    panelTitle: t({ id: 'Bandingkan teks', en: 'Compare text' }),
    run: async () => {
      const [A, B] = await Promise.all(docs.map((d) => words(d.pdf)));
      if (!A.length || !B.length) { toast(t({ id: 'Salah satu PDF tidak punya teks. Kalau hasil scan, jalankan OCR dulu.', en: 'One PDF has no text. If it is a scan, run OCR first.' }), true); return; }
      const ops = diff(A, B);
      if (!ops) { toast(t({ id: 'Kedua PDF terlalu berbeda untuk dibandingkan kata per kata.', en: 'The two PDFs are too different to compare word by word.' }), true); return; }
      const del = ops.filter((o) => o.op === '-').reduce((s, o) => s + o.a.length, 0);
      const ins = ops.filter((o) => o.op === '+').reduce((s, o) => s + o.b.length, 0);
      const names = docs.map((d) => d.file.name);
      const summary = del + ins
        ? t({ id: '{i} kata ditambahkan dan {d} kata dihapus.', en: '{i} words added and {d} words removed.' }, { i: ins, d: del })
        : t({ id: 'Teks kedua PDF sama persis.', en: 'The text of both PDFs is identical.' });
      const el = render(ops, names);
      out.replaceChildren(h('section', { class: 'cmp-out' },
        h('div', { class: 'cmp-head' }, h('div', null, h('h2', null, t({ id: 'Hasil perbandingan', en: 'Comparison' })), h('p', { class: 'note' }, summary)),
          h('button', { class: 'btn small', type: 'button', onclick: () => download(new Blob([report(el, names, summary)], { type: 'text/html' }), `${stem(names[0])}-vs-${stem(names[1])}.html`) },
            h('span', { html: svg(I.download), style: { width: '18px', display: 'inline-flex' } }), t({ id: 'Unduh laporan', en: 'Download report' }))),
        h('p', { class: 'legend' }, h('del', null, t({ id: 'dihapus', en: 'removed' })), ' ', h('ins', null, t({ id: 'ditambahkan', en: 'added' }))),
        el));
      out.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return null;
    },
  });
  const ready = () => ui.setReady(!!(docs[0] && docs[1]));
  async function load(i, file) {
    try { docs[i] = { file, pdf: await openPreview(await readBytes(file)) }; slots[i].show(); ready(); }
    catch (e) { reportError(e); }
  }
  ui.stage.append(h('div', { class: 'cmp-slots' }, slots), out);
  ui.opts.append(h('p', { class: 'note' }, t({ id: 'Teks kedua PDF dibandingkan kata per kata. Perubahan tata letak atau gambar tidak dihitung.', en: 'The text of both PDFs is compared word by word. Layout and image changes are not counted.' })));
  ui.setReady(false);
  const pre = takeHandoff(tool.accept, true);
  if (pre) { load(0, pre[0]); if (pre[1]) load(1, pre[1]); }
}
