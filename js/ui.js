// Reusable tool UI: drop zone, sortable file list, page grid, option fields, run + result.
import { h, t, icon, I, svg, fmtSize, openPreview, renderPage, reportError, download, handoff, readBytes, toast } from './core.js';

const L = {
  drop: { id: 'Pilih file atau tarik ke sini', en: 'Choose files or drop them here' },
  dropOne: { id: 'Pilih file atau tarik ke sini', en: 'Choose a file or drop it here' },
  addMore: { id: 'Tambah file', en: 'Add files' },
  local: { id: 'File tetap di perangkatmu', en: 'Files stay on your device' },
  wrongType: { id: 'Jenis file ini tidak didukung di alat ini: ', en: 'This tool does not accept this file type: ' },
  working: { id: 'Memproses…', en: 'Working…' },
  done: { id: 'Selesai', en: 'Done' },
  again: { id: 'Mulai lagi', en: 'Start over' },
  dl: { id: 'Unduh', en: 'Download' },
  keepEditing: { id: 'Kembali ke pengaturan', en: 'Back to settings' },
};

function accepts(file, accept) {
  return accept.split(',').some((a) => {
    a = a.trim().toLowerCase();
    if (a.startsWith('.')) return file.name.toLowerCase().endsWith(a);
    if (a.endsWith('/*')) return file.type.startsWith(a.slice(0, -1));
    return file.type === a;
  });
}

/** Drop zone. onFiles receives an array of accepted File objects. */
export function dropzone({ accept, multiple, onFiles, label, sub, compact }) {
  const input = h('input', { type: 'file', accept, multiple: !!multiple, class: 'sr', tabindex: '-1' });
  const el = h('div', { class: 'drop' + (compact ? ' compact' : ''), role: 'button', tabindex: '0' },
    icon(compact ? I.plus : I.upload),
    h('strong', null, label || t(multiple ? L.drop : L.dropOne)),
    !compact && h('span', null, sub || t(L.local)),
    input);
  const take = (list) => {
    const files = [...list];
    const ok = files.filter((f) => accepts(f, accept));
    const bad = files.filter((f) => !accepts(f, accept));
    if (bad.length) toast(t(L.wrongType) + bad.map((f) => f.name).join(', '), true);
    if (ok.length) onFiles(multiple ? ok : ok.slice(0, 1));
  };
  el.addEventListener('click', (e) => { if (e.target !== input) input.click(); });
  el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
  input.addEventListener('change', () => { take(input.files); input.value = ''; });
  el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('over'); });
  el.addEventListener('dragleave', () => el.classList.remove('over'));
  el.addEventListener('drop', (e) => { e.preventDefault(); el.classList.remove('over'); take(e.dataTransfer.files); });
  return el;
}

/** Consume files dropped on the home page, if they fit this tool. */
export function takeHandoff(accept, multiple) {
  const f = handoff.files; handoff.files = null;
  if (!f) return null;
  const ok = f.filter((x) => accepts(x, accept));
  return ok.length ? (multiple ? ok : ok.slice(0, 1)) : null;
}

/** Drag-to-reorder for a container's children (desktop), plus explicit move buttons elsewhere. */
export function sortable(container, itemSel, onMove) {
  let dragEl = null;
  container.addEventListener('dragstart', (e) => {
    dragEl = e.target.closest(itemSel); if (!dragEl) return;
    dragEl.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
  });
  container.addEventListener('dragend', () => { dragEl?.classList.remove('dragging'); clear(); dragEl = null; });
  const clear = () => container.querySelectorAll('.drop-before').forEach((x) => x.classList.remove('drop-before'));
  container.addEventListener('dragover', (e) => {
    if (!dragEl) return; e.preventDefault();
    const over = e.target.closest(itemSel); clear();
    if (over && over !== dragEl) over.classList.add('drop-before');
  });
  container.addEventListener('drop', (e) => {
    if (!dragEl) return; e.preventDefault();
    const items = [...container.querySelectorAll(itemSel)];
    const over = e.target.closest(itemSel);
    const from = items.indexOf(dragEl);
    let to = over ? items.indexOf(over) : items.length;
    if (to > from) to--;
    clear();
    if (from !== to && from > -1) onMove(from, to);
  });
}

export const move = (arr, from, to) => { const [x] = arr.splice(from, 1); arr.splice(to, 0, x); };

/** Sortable list of files with thumbnails. Returns { el, items, render } */
export function fileList({ items, onChange, thumb }) {
  const ul = h('ul', { class: 'files' });
  const render = () => {
    ul.replaceChildren(...items.map((it, i) => {
      const th = h('div', { class: 'thumb' });
      if (it.thumbEl) th.append(it.thumbEl); else thumb?.(it).then((c) => { if (c) { it.thumbEl = c; th.replaceChildren(c); } });
      return h('li', { class: 'file', draggable: 'true' },
        h('span', { class: 'grip', html: svg(I.grip) }),
        th,
        h('div', { class: 'meta' }, h('b', null, it.file.name), h('span', null, [fmtSize(it.file.size), it.info].filter(Boolean).join(' · '))),
        h('div', { class: 'acts' },
          h('button', { class: 'mini', type: 'button', 'aria-label': t({ id: 'Naikkan', en: 'Move up' }), disabled: i === 0, html: svg(I.up), onclick: () => { move(items, i, i - 1); render(); onChange(); } }),
          h('button', { class: 'mini', type: 'button', 'aria-label': t({ id: 'Turunkan', en: 'Move down' }), disabled: i === items.length - 1, html: svg(I.down), onclick: () => { move(items, i, i + 1); render(); onChange(); } }),
          h('button', { class: 'mini', type: 'button', 'aria-label': t({ id: 'Hapus', en: 'Remove' }), html: svg(I.x), onclick: () => { items.splice(i, 1); render(); onChange(); } })));
    }));
  };
  sortable(ul, '.file', (a, b) => { move(items, a, b); render(); onChange(); });
  render();
  return { el: ul, render };
}

/**
 * Grid of page thumbnails for one or more PDFs.
 * pages: [{ doc (pdf.js), srcIndex (0-based), rotation, selected, deleted, tag }]
 * opts.mode: 'select' | 'organize' | 'rotate' | 'view'
 */
export function pageGrid({ pages, mode = 'select', onChange = () => {}, tags = false, selectStyle = 'sel' }) {
  const grid = h('div', { class: 'pages' });
  const cache = new Map();
  const io = new IntersectionObserver((ents) => {
    for (const e of ents) if (e.isIntersecting) { io.unobserve(e.target); draw(e.target); }
  }, { rootMargin: '300px' });

  async function draw(pv) {
    const p = pv._page; if (!p) return;
    const key = p.doc.fingerprints?.[0] + ':' + p.srcIndex;
    try {
      let c = cache.get(key);
      if (!c) { c = renderPage(p.doc, p.srcIndex + 1, 150); cache.set(key, c); }
      const canvas = await c;
      const copy = h('canvas'); copy.width = canvas.width; copy.height = canvas.height;
      copy.getContext('2d').drawImage(canvas, 0, 0);
      copy.style.transform = `rotate(${p.rotation || 0}deg)`;
      if ((p.rotation || 0) % 180) copy.style.maxWidth = copy.style.maxHeight = '66%';
      pv.replaceChildren(copy);
    } catch (e) { console.error(e); }
  }

  function render() {
    grid.replaceChildren(...pages.map((p, i) => {
      const pv = h('div', { class: 'pv' }); pv._page = p;
      const card = h('div', { class: 'page' + (p.selected ? (selectStyle === 'del' ? ' sel del' : ' sel') : '') + (p.deleted ? ' del' : ''), draggable: mode === 'organize' ? 'true' : null });
      if (mode === 'select') card.append(h('span', { class: 'tick', html: svg(I.check) }));
      if (tags && p.tag) card.append(h('span', { class: 'src' }, p.tag));
      card.append(pv);
      const acts = h('div', { class: 'acts', style: { display: 'flex' } });
      const btn = (ic, label, fn) => h('button', { class: 'mini', type: 'button', 'aria-label': label, title: label, html: svg(ic), onclick: (e) => { e.stopPropagation(); fn(); render(); onChange(); } });
      if (mode === 'rotate' || mode === 'organize') {
        acts.append(btn(I.rotL, t({ id: 'Putar ke kiri', en: 'Rotate left' }), () => (p.rotation = ((p.rotation || 0) + 270) % 360)));
        acts.append(btn(I.rotR, t({ id: 'Putar ke kanan', en: 'Rotate right' }), () => (p.rotation = ((p.rotation || 0) + 90) % 360)));
      }
      if (mode === 'organize') {
        acts.append(btn(I.copy, t({ id: 'Gandakan', en: 'Duplicate' }), () => pages.splice(i + 1, 0, { ...p, selected: false })));
        acts.append(btn(I.trash, t({ id: 'Hapus halaman', en: 'Delete page' }), () => pages.splice(i, 1)));
      }
      card.append(h('div', { class: 'foot-row' }, h('span', { class: 'num' }, i + 1), acts));
      if (mode === 'organize') { // touch screens can't drag-and-drop natively, so offer explicit moves
        const mv = h('div', { class: 'foot-row touch-only' });
        const b1 = btn(I.left, t({ id: 'Geser ke kiri', en: 'Move left' }), () => move(pages, i, i - 1)); b1.disabled = i === 0;
        const b2 = btn(I.right, t({ id: 'Geser ke kanan', en: 'Move right' }), () => move(pages, i, i + 1)); b2.disabled = i === pages.length - 1;
        mv.append(b1, b2); card.append(mv);
      }
      if (mode === 'select') {
        card.tabIndex = 0; card.setAttribute('role', 'checkbox'); card.setAttribute('aria-checked', String(!!p.selected));
        card.setAttribute('aria-label', t({ id: 'Halaman ', en: 'Page ' }) + (i + 1));
        const toggle = () => { p.selected = !p.selected; render(); onChange(); grid.children[i]?.focus(); };
        card.addEventListener('click', toggle);
        card.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(); } });
      } else if (mode === 'rotate') {
        pv.addEventListener('click', () => { p.rotation = ((p.rotation || 0) + 90) % 360; render(); onChange(); });
      }
      io.observe(pv);
      return card;
    }));
  }
  if (mode === 'organize') sortable(grid, '.page', (a, b) => { move(pages, a, b); render(); onChange(); });
  render();
  return { el: grid, render };
}

/** Load a PDF File into page entries for pageGrid. */
export async function pagesOf(file, tag) {
  const bytes = await readBytes(file);
  const doc = await openPreview(bytes);
  return { bytes, doc, pages: Array.from({ length: doc.numPages }, (_, i) => ({ doc, srcIndex: i, rotation: 0, selected: false, tag, bytes })) };
}

// ---------- Fields ----------
let fid = 0;
export function field(label, control, hint) {
  const id = 'f' + (++fid);
  control.id ||= id;
  const lbl = control.matches?.('input, select, textarea') ? h('label', { for: control.id }, label) : h('span', { class: 'lbl' }, label);
  return h('div', { class: 'field' }, lbl, control, hint && h('span', { class: 'hint' }, hint));
}
export function seg(options, value, onChange) {
  const wrap = h('div', { class: 'seg', role: 'group' });
  const draw = () => wrap.replaceChildren(...options.map(([v, label]) => h('button', {
    type: 'button', 'aria-pressed': String(v === value), onclick: () => { value = v; draw(); onChange(v); },
  }, label)));
  draw();
  return wrap;
}
export function posGrid(value, onChange) {
  const keys = ['tl', 'tc', 'tr', 'ml', 'mc', 'mr', 'bl', 'bc', 'br'];
  const wrap = h('div', { class: 'pos-grid', role: 'group' });
  const draw = () => wrap.replaceChildren(...keys.map((k) => h('button', {
    type: 'button', 'aria-pressed': String(k === value), 'aria-label': k, onclick: () => { value = k; draw(); onChange(k); },
  })));
  draw();
  return wrap;
}
export function range(min, max, step, value, onInput, fmt = (v) => v) {
  const out = h('span', { class: 'hint' }, fmt(value));
  const r = h('input', { type: 'range', min, max, step, value, oninput: () => { out.textContent = fmt(+r.value); onInput(+r.value); } });
  const wrap = h('div', { class: 'row' }, r); out.style.flex = '0 0 52px'; out.style.textAlign = 'right'; wrap.append(out);
  return wrap;
}

/**
 * Standard tool shell. Returns { stage, panel, setReady(bool), showResult(...) }.
 * run: async () => result; result = { files: [{name, data, type}], summary }
 */
export function shell(root, { actionLabel, run, panelTitle }) {
  const stage = h('div', { class: 'stage' });
  const opts = h('div', { style: { display: 'grid', gap: '16px' } });
  const btn = h('button', { class: 'btn primary', type: 'button', disabled: true }, actionLabel);
  const panel = h('aside', { class: 'panel', hidden: true }, panelTitle && h('h3', null, panelTitle), opts, btn);
  const work = h('div', { class: 'work' }, stage, panel);
  root.append(work);
  let busy = false;
  btn.addEventListener('click', async () => {
    if (busy) return; busy = true;
    btn.disabled = true; btn.replaceChildren(h('span', { class: 'spin' }), t(L.working));
    try {
      const res = await run();
      if (res) showResult(res);
    } catch (e) { reportError(e); }
    finally { busy = false; btn.disabled = false; btn.replaceChildren(actionLabel); }
  });
  let saved = null;
  function showResult({ files, summary, extra }) {
    saved = [...stage.childNodes];
    panel.hidden = true; work.classList.add('single');
    const one = files.length === 1;
    const zipFirst = files.length > 1 && files[0].type === 'application/zip';
    const main = one || zipFirst ? files[0] : null;
    const rest = zipFirst ? files.slice(1) : one ? [] : files;
    const dlAll = h('button', { class: 'btn primary', type: 'button', onclick: () => (main ? [main] : files).forEach((f) => download(f.data, f.name, f.type)) },
      h('span', { html: svg(I.download), style: { width: '20px', display: 'inline-flex' } }), main ? t(L.dl) + ' ' + main.name : t({ id: 'Unduh semua', en: 'Download all' }));
    const res = h('section', { class: 'result' },
      h('h2', null, icon(I.checkCircle), t(L.done)),
      summary && h('p', null, summary),
      extra,
      rest.length > 0 && h('ul', { class: 'outlist' }, rest.map((f) => h('li', null, h('span', null, f.name), h('a', { href: '#', onclick: (e) => { e.preventDefault(); download(f.data, f.name, f.type); } }, t(L.dl))))),
      h('div', { class: 'acts' }, files.length ? dlAll : null,
        h('button', { class: 'btn', type: 'button', onclick: back }, t(L.keepEditing)),
        h('button', { class: 'btn', type: 'button', onclick: () => window.dispatchEvent(new HashChangeEvent('hashchange')) }, t(L.again))));
    stage.replaceChildren(res);
    if (main) download(main.data, main.name, main.type); // start the main download right away
    res.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function back() { stage.replaceChildren(...saved); panel.hidden = false; work.classList.remove('single'); }
  return {
    stage, opts, panel,
    setReady(ok) { panel.hidden = false; btn.disabled = !ok; },
    hidePanel() { panel.hidden = true; },
  };
}
