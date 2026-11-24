import { h, t, stem, qpdf, UserError } from '../core.js';
import { shell, field } from '../ui.js';
import { singlePdf } from './_single.js';

export async function mount(root, tool) {
  let ctx;
  const pw = h('input', { type: 'password', autocomplete: 'new-password' });
  const pw2 = h('input', { type: 'password', autocomplete: 'new-password' });
  const noPrint = h('input', { type: 'checkbox' }), noCopy = h('input', { type: 'checkbox' }), noEdit = h('input', { type: 'checkbox', checked: true });
  const show = h('input', { type: 'checkbox', onchange: () => { pw.type = pw2.type = show.checked ? 'text' : 'password'; } });
  const ui = shell(root, {
    actionLabel: t({ id: 'Kunci PDF', en: 'Protect PDF' }),
    panelTitle: t({ id: 'Kata sandi', en: 'Password' }),
    run: async () => {
      if (pw.value.length < 4) throw new UserError(t({ id: 'Pakai kata sandi minimal 4 karakter.', en: 'Use a password of at least 4 characters.' }));
      if (pw.value !== pw2.value) throw new UserError(t({ id: 'Kedua kata sandi belum sama. Ketik ulang di kolom kedua.', en: 'The passwords do not match. Retype it in the second field.' }));
      const owner = pw.value + ':' + crypto.getRandomValues(new Uint32Array(2)).join('');
      const args = ['--encrypt', pw.value, owner, '256'];
      if (noPrint.checked) args.push('--print=none');
      if (noCopy.checked) args.push('--extract=n');
      if (noEdit.checked) args.push('--modify=none');
      args.push('--', '{in}', '{out}');
      const out = (await qpdf()).run(args, ctx.bytes);
      return { files: [{ name: stem(ctx.file.name) + '-terkunci.pdf', data: out }],
        summary: t({ id: 'PDF dikunci dengan AES-256. Simpan kata sandinya baik-baik: PDFDika tidak menyimpannya dan tidak bisa memulihkannya.', en: 'PDF locked with AES-256. Keep the password safe: PDFDika does not store it and cannot recover it.' }) };
    },
  });
  singlePdf(ui, tool, (c) => {
    ctx = c;
    ui.opts.append(field(t({ id: 'Kata sandi', en: 'Password' }), pw), field(t({ id: 'Ulangi kata sandi', en: 'Repeat password' }), pw2),
      h('label', { class: 'check' }, show, t({ id: 'Tampilkan kata sandi', en: 'Show password' })),
      h('hr', { class: 'sep' }),
      h('label', { class: 'check' }, noEdit, t({ id: 'Larang mengubah isi', en: 'Block editing' })),
      h('label', { class: 'check' }, noCopy, t({ id: 'Larang menyalin teks', en: 'Block copying text' })),
      h('label', { class: 'check' }, noPrint, t({ id: 'Larang mencetak', en: 'Block printing' })));
    ui.setReady(true); pw.focus();
  });
}
