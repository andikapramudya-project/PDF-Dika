import { h, t, svg, I, UserError, reportError } from '../core.js';
import { shell, field, seg } from '../ui.js';
import { singlePdf } from './_single.js';
import { placer, imageStamp, canvasStamp, trim } from './_placer.js';

const INK = ['#141A33', '#1D3FBF', '#B01E3C'];

export async function mount(root, tool) {
  let pl, active = null; const saved = [];
  const ui = shell(root, {
    actionLabel: t({ id: 'Simpan PDF bertanda tangan', en: 'Save signed PDF' }),
    panelTitle: t({ id: 'Tanda tanganmu', en: 'Your signature' }),
    run: async () => {
      if (!pl.items.length) throw new UserError(t({ id: 'Klik di halaman untuk menempatkan tanda tangan dulu.', en: 'Click on the page to place your signature first.' }));
      return { files: [await pl.apply('-ttd')], summary: t({ id: '{n} tanda tangan ditempatkan.', en: '{n} signature(s) placed.' }, { n: pl.items.length }) };
    },
  });
  singlePdf(ui, tool, (ctx) => {
    let mode = 'draw', ink = INK[0];
    const area = h('div', { style: { display: 'grid', gap: '10px' } });
    const chips = h('div', { class: 'sig-preview' });
    const status = h('p', { class: 'note' });
    const drawChips = () => {
      chips.replaceChildren(...saved.map((s) => h('button', { type: 'button', 'aria-pressed': String(s === active), style: s === active ? { outline: '3px solid var(--accent)' } : null, onclick: () => { active = s; drawChips(); } }, h('img', { src: s.url, alt: t({ id: 'Tanda tangan tersimpan', en: 'Saved signature' }) }))));
      status.textContent = active ? t({ id: 'Sekarang klik di halaman untuk menempatkannya. Bisa berkali-kali.', en: 'Now click on the page to place it. You can place it more than once.' }) : t({ id: 'Buat tanda tangan dulu, lalu klik di halaman.', en: 'Create a signature first, then click on the page.' });
    };
    const keep = (s) => { saved.push(s); active = s; drawChips(); };
    const inkPick = () => h('div', { class: 'row', style: { justifyContent: 'flex-start', gap: '6px' } }, INK.map((c) => h('button', { type: 'button', 'aria-label': c, style: { flex: 'none', width: '28px', height: '28px', borderRadius: '50%', border: c === ink ? '3px solid var(--accent)' : '2px solid var(--line)', background: c, cursor: 'pointer' }, onclick: () => { ink = c; draw(); } })));

    function draw() {
      if (mode === 'draw') {
        const pad = h('canvas', { class: 'sigpad' });
        let down = false, last;
        const ctx2 = () => pad.getContext('2d');
        const fit = () => { // size the bitmap to the box once it is visible
          const r = pad.getBoundingClientRect(); const w = Math.round(r.width * 2);
          if (!w || pad.width === w) return;
          pad.width = w; pad.height = Math.round(r.height * 2);
          const g = ctx2(); g.scale(2, 2); g.lineCap = g.lineJoin = 'round'; g.strokeStyle = ink; g.lineWidth = 2.6;
        };
        const pt = (e) => { const r = pad.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
        pad.addEventListener('pointerdown', (e) => { fit(); down = true; last = pt(e); pad.setPointerCapture(e.pointerId); });
        pad.addEventListener('pointermove', (e) => { if (!down) return; const p = pt(e); const g = ctx2(); g.beginPath(); g.moveTo(...last); g.lineTo(...p); g.stroke(); last = p; });
        pad.addEventListener('pointerup', () => (down = false));
        area.replaceChildren(pad, inkPick(), h('div', { class: 'row' },
          h('button', { class: 'btn small', type: 'button', onclick: () => ctx2().clearRect(0, 0, pad.width, pad.height) }, t({ id: 'Hapus', en: 'Clear' })),
          h('button', { class: 'btn small', type: 'button', onclick: async () => { const c = trim(pad); if (!c) return reportError(new UserError(t({ id: 'Kotaknya masih kosong. Gambar tanda tangan dulu.', en: 'The box is empty. Draw your signature first.' }))); keep(await canvasStamp(c)); } }, t({ id: 'Pakai tanda tangan', en: 'Use signature' }))));
      } else if (mode === 'type') {
        const name = h('input', { type: 'text', placeholder: t({ id: 'Nama lengkap', en: 'Full name' }) });
        const styles = ['italic 600 64px "Segoe Script","Brush Script MT","Snell Roundhand",cursive', 'italic 400 60px Georgia,"Times New Roman",serif', '600 56px "Bricolage",system-ui,sans-serif'];
        let st = 0;
        area.replaceChildren(field(t({ id: 'Ketik namamu', en: 'Type your name' }), name), field(t({ id: 'Gaya', en: 'Style' }), seg([[0, t({ id: 'Sambung', en: 'Script' })], [1, 'Serif'], [2, 'Sans']], 0, (v) => (st = v))), inkPick(),
          h('button', { class: 'btn small', type: 'button', onclick: async () => {
            if (!name.value.trim()) return reportError(new UserError(t({ id: 'Ketik nama dulu.', en: 'Type a name first.' })));
            await document.fonts.ready;
            const c = h('canvas'); c.width = 1400; c.height = 200; const g = c.getContext('2d');
            g.font = styles[st]; g.fillStyle = ink; g.textBaseline = 'middle'; g.fillText(name.value, 20, 100);
            keep(await canvasStamp(trim(c)));
          } }, t({ id: 'Pakai tanda tangan', en: 'Use signature' })));
      } else {
        const rmw = h('input', { type: 'checkbox', checked: true });
        const inp = h('input', { type: 'file', accept: 'image/*', class: 'sr', onchange: async () => { if (inp.files[0]) keep(await imageStamp(inp.files[0], rmw.checked)); inp.value = ''; } });
        area.replaceChildren(h('button', { class: 'btn', type: 'button', onclick: () => inp.click() }, h('span', { html: svg(I.upload), style: { width: '18px', display: 'inline-flex' } }), t({ id: 'Pilih foto tanda tangan', en: 'Choose a signature photo' })), inp,
          h('label', { class: 'check' }, rmw, t({ id: 'Hilangkan latar putih', en: 'Remove white background' })));
      }
    }
    ui.opts.append(seg([['draw', t({ id: 'Gambar', en: 'Draw' })], ['type', t({ id: 'Ketik', en: 'Type' })], ['upload', t({ id: 'Unggah', en: 'Upload' })]], mode, (v) => { mode = v; draw(); }), area, chips, status);
    draw(); drawChips();
    pl = placer(ctx, { getStamp: () => { if (!active) { reportError(new UserError(t({ id: 'Buat tanda tangan di panel dulu.', en: 'Create a signature in the panel first.' }))); return null; } return { ...active, widthPt: 160 }; } });
    ui.stage.append(pl.el);
    ui.setReady(true);
  });
}
