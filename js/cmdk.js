// Command palette: Ctrl/Cmd + K (or "/" away from the home search) jumps to any tool by name.
import { h, t, $, svg, I } from './core.js';
import { TOOLS, CATS, matches } from './tools.js';

const L = {
  title: { id: 'Cari alat', en: 'Find a tool' },
  trigger: { id: 'Cari alat…', en: 'Find a tool…' },
  ph: { id: 'Ketik nama alat, misalnya “gabung”', en: 'Type a tool name, e.g. “merge”' },
  none: { id: 'Tidak ada alat yang cocok dengan “{q}”.', en: 'No tool matches “{q}”.' },
  open: { id: 'buka', en: 'open' },
  move: { id: 'pilih', en: 'select' },
  close: { id: 'tutup', en: 'close' },
};
const isMac = /Mac|iPhone|iPad/.test(navigator.userAgent);

let dlg, input, list, foot, shown = [], active = 0, opener = null;

function build() {
  input = h('input', {
    type: 'text', role: 'combobox', 'aria-expanded': 'true', 'aria-controls': 'cmdk-list', 'aria-autocomplete': 'list',
    autocomplete: 'off', spellcheck: 'false', enterkeyhint: 'go',
  });
  list = h('div', { class: 'cmdk-list', id: 'cmdk-list', role: 'listbox' });
  foot = h('div', { class: 'cmdk-foot', 'aria-hidden': 'true' });
  dlg = h('dialog', { class: 'cmdk' }, h('div', { class: 'cmdk-in' }, h('span', { html: svg(I.search) }), input), list, foot);
  // A click on the backdrop lands on the dialog element itself.
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', () => { if (opener && document.contains(opener)) opener.focus(); opener = null; });
  input.addEventListener('input', () => { active = 0; draw(); });
  input.addEventListener('keydown', onKey);
  document.body.append(dlg);
}

function draw() {
  const q = input.value.trim();
  shown = [];
  const kids = [];
  // Tools whose name matches come before ones that only match by description or keyword.
  const ql = q.toLowerCase();
  const score = (x) => { const n = t(x.name).toLowerCase(); return !ql ? 0 : n.startsWith(ql) ? 2 : n.includes(ql) ? 1 : 0; };
  const groups = CATS.map((c) => TOOLS.filter((x) => x.cat === c.id && matches(x, q)).sort((a, b) => score(b) - score(a)))
    .map((tools, i) => ({ c: CATS[i], tools, best: tools.length ? score(tools[0]) : -1 }))
    .filter((g) => g.tools.length).sort((a, b) => b.best - a.best);
  for (const { c, tools } of groups) {
    const gid = 'cmdk-g-' + c.id;
    kids.push(h('div', { role: 'group', 'aria-labelledby': gid },
      h('div', { class: 'cmdk-group', id: gid }, t(c.name)),
      tools.map((tool) => {
        const i = shown.push(tool) - 1;
        return h('a', {
          class: 'cmdk-item', role: 'option', id: 'cmdk-o-' + i, href: '#/' + tool.id, tabindex: '-1',
          'aria-selected': String(i === active),
          onmousemove: () => { if (active !== i) { active = i; mark(); } },
          onclick: () => dlg.close(),
        }, h('span', { html: svg(tool.icon) }), t(tool.name), h('small', null, t(tool.desc)));
      })));
  }
  list.replaceChildren(...(kids.length ? kids : [h('p', { class: 'cmdk-empty' }, t(L.none, { q }))]));
  mark();
}

function mark() {
  list.querySelectorAll('[role="option"]').forEach((o, i) => o.setAttribute('aria-selected', String(i === active)));
  const cur = shown.length ? $('#cmdk-o-' + active) : null;
  if (cur) { input.setAttribute('aria-activedescendant', cur.id); cur.scrollIntoView({ block: 'nearest' }); }
  else input.removeAttribute('aria-activedescendant');
}

function onKey(e) {
  const n = shown.length;
  if (e.key === 'ArrowDown' && n) { e.preventDefault(); active = (active + 1) % n; mark(); }
  else if (e.key === 'ArrowUp' && n) { e.preventDefault(); active = (active - 1 + n) % n; mark(); }
  else if (e.key === 'Home' && n && e.ctrlKey) { e.preventDefault(); active = 0; mark(); }
  else if (e.key === 'End' && n && e.ctrlKey) { e.preventDefault(); active = n - 1; mark(); }
  else if (e.key === 'Enter' && n) {
    e.preventDefault();
    const id = shown[active].id;
    dlg.close();
    location.hash = '#/' + id;
  }
}

export function openPalette() {
  if (!dlg) build();
  if (dlg.open) { input.select(); return; }
  dlg.setAttribute('aria-label', t(L.title));
  input.placeholder = t(L.ph);
  input.setAttribute('aria-label', t(L.title));
  foot.replaceChildren(
    h('span', null, h('kbd', null, '↑'), h('kbd', null, '↓'), t(L.move)),
    h('span', null, h('kbd', null, 'Enter'), t(L.open)),
    h('span', null, h('kbd', null, 'Esc'), t(L.close)));
  input.value = ''; active = 0; draw();
  opener = document.activeElement;
  dlg.showModal();
  input.focus();
}

/** Keep the top-bar trigger in the current language. */
export function paletteChrome() {
  $('#cmdkLabel').textContent = t(L.trigger);
  $('#cmdkKbd').textContent = isMac ? '⌘K' : 'Ctrl K';
  $('#cmdkBtn').setAttribute('aria-label', t(L.title));
}
