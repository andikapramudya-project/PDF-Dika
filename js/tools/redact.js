import { h, t, svg, I, stem, openPdf, renderPage, toast } from '../core.js';
import { shell, field } from '../ui.js';
import { singlePdf } from './_single.js';
import { viewer, place } from './_viewer.js';

/** Boxes (on-screen fractions) for every match of q on a page. */
async function findOnPage(page, q) {
  const vp = page.getViewport({ scale: 1 });
  const tc = await page.getTextContent();
  const boxes = [];
  const needle = q.toLowerCase();
  for (const it of tc.items) {
    const s = (it.str || '').toLowerCase();
    if (!s || !it.width) continue;
    for (let at = s.indexOf(needle); at >= 0; at = s.indexOf(needle, at + needle.length)) {
      const [a, b, c, d, e, f] = it.transform;
      const len = Math.hypot(a, b) || 1;
      const run = [(a / len) * it.width, (b / len) * it.width];
      const up = [c, d];
      const f0 = at / s.length, f1 = (at + needle.length) / s.length;
      const o = [e + run[0] * f0, f + run[1] * f0], o2 = [e + run[0] * f1, f + run[1] * f1];
      const pts = [[o[0] - up[0] * 0.25, o[1] - up[1] * 0.25], [o2[0] - up[0] * 0.25, o2[1] - up[1] * 0.25], [o[0] + up[0] * 0.95, o[1] + up[1] * 0.95], [o2[0] + up[0] * 0.95, o2[1] + up[1] * 0.95]]
        .map(([x, y]) => vp.convertToViewportPoint(x, y));
      const xs = pts.map((p) => p[0] / vp.width), ys = pts.map((p) => p[1] / vp.height);
      boxes.push({ x0: Math.min(...xs) - 0.002, y0: Math.min(...ys) - 0.002, x1: Math.max(...xs) + 0.002, y1: Math.max(...ys) + 0.002 });
    }
  }
  return boxes;
}

export async function mount(root, tool) {
  let ctx, v, scrub = true;
  const boxes = new Map(); // page -> [{x0,y0,x1,y1}]
  const count = h('p', null);
  const total = () => [...boxes.values()].reduce((s, a) => s + a.length, 0);
  const upd = () => { const n = total(); count.textContent = t({ id: '{n} area akan disensor di {p} halaman.', en: '{n} areas will be redacted on {p} pages.' }, { n, p: [...boxes.values()].filter((a) => a.length).length }); ui.setReady(n > 0); };

  const ui = shell(root, {
    actionLabel: t({ id: 'Sensor permanen', en: 'Redact for good' }),
    panelTitle: t({ id: 'Sensor', en: 'Redaction' }),
    run: async () => {
      const doc = await openPdf(ctx.bytes);
      const pages = [...boxes.entries()].filter(([, a]) => a.length).sort((a, b) => a[0] - b[0]);
      for (const [n, list] of pages) {
        const page = await ctx.doc.getPage(n);
        const vp = page.getViewport({ scale: 1 });
        const canvas = await renderPage(ctx.doc, n, (vp.width * 200 / 72) / Math.min(window.devicePixelRatio || 1, 2));
        const g = canvas.getContext('2d'); g.fillStyle = '#000';
        for (const b of list) g.fillRect(b.x0 * canvas.width, b.y0 * canvas.height, (b.x1 - b.x0) * canvas.width, (b.y1 - b.y0) * canvas.height);
        const jpg = new Uint8Array(await (await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.9))).arrayBuffer());
        const img = await doc.embedJpg(jpg);
        const np = doc.insertPage(n - 1, [vp.width, vp.height]); // the old page and everything on it goes away
        np.drawImage(img, { x: 0, y: 0, width: vp.width, height: vp.height });
        doc.removePage(n);
      }
      if (scrub) {
        doc.setTitle(''); doc.setAuthor(''); doc.setSubject(''); doc.setKeywords([]); doc.setCreator(''); doc.setProducer('');
      }
      return { files: [{ name: stem(ctx.file.name) + '-disensor.pdf', data: await doc.save() }],
        summary: t({ id: '{n} area disensor. Halaman yang disensor diubah menjadi gambar, jadi teks di baliknya benar-benar hilang.', en: '{n} areas redacted. Redacted pages were turned into images, so the text underneath is truly gone.' }, { n: total() }) };
    },
  });

  function drawBox(layer, n, b) {
    const el = h('div', { class: 'vbox redact' });
    const rm = h('button', { class: 'rm', type: 'button', 'aria-label': t({ id: 'Hapus kotak', en: 'Remove box' }), html: svg(I.x), onclick: (e) => { e.stopPropagation(); const a = boxes.get(n); a.splice(a.indexOf(b), 1); el.remove(); upd(); } });
    rm.addEventListener('pointerdown', (e) => e.stopPropagation());
    el.append(rm); place(el, b); layer.append(el);
  }

  singlePdf(ui, tool, async (c) => {
    ctx = c; boxes.clear();
    v = viewer(c.doc, {
      hint: t({ id: 'Seret di halaman untuk menutup bagian yang ingin disensor.', en: 'Drag on the page to cover what you want to redact.' }),
      onPage: (n, layer) => (boxes.get(n) || []).forEach((b) => drawBox(layer, n, b)),
    });
    v.drawBoxes((b) => { const n = v.page; if (!boxes.has(n)) boxes.set(n, []); boxes.get(n).push(b); drawBox(v.layer, n, b); upd(); });
    const q = h('input', { type: 'search', placeholder: t({ id: 'mis. nama, NIK, nomor rekening', en: 'e.g. a name or account number' }) });
    const find = async () => {
      const s = q.value.trim(); if (!s) return;
      let hits = 0;
      for (let i = 1; i <= c.doc.numPages; i++) {
        const found = await findOnPage(await c.doc.getPage(i), s);
        if (!found.length) continue;
        if (!boxes.has(i)) boxes.set(i, []);
        boxes.get(i).push(...found); hits += found.length;
      }
      upd(); v.go(v.page);
      toast(hits ? t({ id: '{n} hasil ditandai untuk disensor.', en: '{n} matches marked for redaction.' }, { n: hits }) : t({ id: 'Teks itu tidak ditemukan. Kalau PDF hasil scan, tandai manual dengan menyeret.', en: 'That text was not found. If the PDF is a scan, mark it by dragging.' }));
    };
    q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); find(); } });
    const clear = h('button', { class: 'btn small', type: 'button', onclick: () => { boxes.clear(); upd(); v.go(v.page); } }, t({ id: 'Hapus semua tanda', en: 'Clear all marks' }));
    ui.opts.append(
      field(t({ id: 'Cari teks untuk disensor', en: 'Find text to redact' }), h('div', { class: 'row' }, q, h('button', { class: 'btn small', type: 'button', style: { flex: 'none' }, onclick: find }, t({ id: 'Tandai', en: 'Mark' })))),
      count, clear,
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: true, onchange: (e) => (scrub = e.target.checked) }), t({ id: 'Hapus juga metadata (judul, penulis)', en: 'Also remove metadata (title, author)' })),
      h('p', { class: 'note' }, t({ id: 'Halaman yang disensor disimpan sebagai gambar, sehingga teks di bawah kotak hitam tidak bisa disalin atau dipulihkan.', en: 'Redacted pages are saved as images, so the text under the black boxes cannot be copied or recovered.' })));
    ui.stage.append(v.el);
    upd();
    await v.go(1);
  });
}
