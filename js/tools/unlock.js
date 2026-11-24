import { h, t, stem, qpdf, readBytes, reportError, UserError } from '../core.js';
import { shell, field, dropzone, takeHandoff } from '../ui.js';

export async function mount(root, tool) {
  let file, bytes;
  const pw = h('input', { type: 'password', autocomplete: 'current-password' });
  const ui = shell(root, {
    actionLabel: t({ id: 'Buka kunci', en: 'Unlock PDF' }),
    panelTitle: t({ id: 'Kata sandi', en: 'Password' }),
    run: async () => {
      let out;
      try { out = (await qpdf()).run([`--password=${pw.value}`, '--decrypt', '{in}', '{out}'], bytes); }
      catch (e) {
        if (e.code === 2) throw new UserError(t({ id: 'Kata sandinya salah. Periksa huruf besar-kecil, lalu coba lagi.', en: 'That password is wrong. Check upper and lower case, then try again.' }));
        throw e;
      }
      return { files: [{ name: stem(file.name) + '-terbuka.pdf', data: out }], summary: t({ id: 'Kata sandi dan batasan sudah dihapus. File ini sekarang bisa dibuka tanpa kata sandi.', en: 'Password and restrictions removed. The file now opens without a password.' }) };
    },
  });
  const big = dropzone({ accept: tool.accept, onFiles: (f) => load(f[0]) });
  ui.stage.append(big);
  async function load(f) {
    try {
      file = f; bytes = await readBytes(f);
      ui.stage.replaceChildren(h('section', { class: 'result' }, h('h2', { style: { fontSize: '1.15rem' } }, f.name),
        h('p', null, t({ id: 'Masukkan kata sandi untuk membuka file ini. Jika PDF hanya punya batasan (tanpa kata sandi pembuka), kosongkan saja.', en: 'Enter the password that opens this file. If the PDF only has restrictions (no open password), leave it empty.' })),
        h('button', { class: 'btn small', type: 'button', onclick: () => { ui.stage.replaceChildren(big); ui.hidePanel(); } }, t({ id: 'Ganti file', en: 'Change file' }))));
      ui.opts.replaceChildren(field(t({ id: 'Kata sandi', en: 'Password' }), pw),
        h('p', { class: 'note' }, t({ id: 'Gunakan hanya untuk file milikmu atau yang kamu berhak buka.', en: 'Use only on files you own or are allowed to open.' })));
      ui.setReady(true); pw.focus();
      pw.onkeydown = (e) => { if (e.key === 'Enter') ui.panel.querySelector('.btn.primary').click(); };
    } catch (e) { reportError(e); }
  }
  const pre = takeHandoff(tool.accept, false); if (pre) load(pre[0]);
}
