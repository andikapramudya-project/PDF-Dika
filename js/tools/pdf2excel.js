import { h, t, stem, JSZip, UserError } from '../core.js';
import { shell, field, seg, pageGrid } from '../ui.js';
import { singlePdf } from './_single.js';

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
const colName = (i) => { let s = ''; for (i++; i; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s; return s; };

/** Which separators the document uses: 'id' (1.234,5) or 'en' (1,234.5), guessed from unambiguous numbers. */
export function numberStyle(cells) {
  let id = 0, en = 0;
  for (const c of cells) {
    const v = c.replace(/\s/g, '');
    if (/^-?\d{1,3}(\.\d{3}){2,}(,\d+)?$/.test(v) || /^-?\d+,\d{1,2}%?$/.test(v) || /\.\d{3},\d/.test(v)) id++;
    if (/^-?\d{1,3}(,\d{3}){2,}(\.\d+)?$/.test(v) || /^-?\d+\.\d{1,2}%?$/.test(v) || /,\d{3}\.\d/.test(v)) en++;
  }
  return id > en ? 'id' : en > id ? 'en' : null;
}

/** A number when the text reads one way only in this document's style (so "1.234" stays text if unsure). */
export function asNumber(s, style) {
  const v = s.replace(/\s/g, '');
  if (!/^-?[\d.,]+$/.test(v) || /^-?0\d/.test(v)) return null; // keep codes like 0812… as text
  if (/^-?\d+$/.test(v)) return v.length < 16 ? +v : null;
  const [th, dec] = style === 'en' ? [',', '.'] : style === 'id' ? ['.', ','] : [null, null];
  if (th) {
    const re = new RegExp(`^(-?)(\\d{1,3}(?:\\${th}\\d{3})*|\\d+)(?:\\${dec}(\\d+))?$`);
    const m = re.exec(v);
    if (m) return +(m[1] + m[2].split(th).join('') + (m[3] ? '.' + m[3] : ''));
    return null;
  }
  let m;
  if ((m = /^(-?\d+)[.,](\d{1,2}|\d{4,})$/.exec(v))) return +(m[1] + '.' + m[2]);
  return null;
}

/** Rebuild table rows from the text positions on one page. */
async function pageRows(page) {
  const tc = await page.getTextContent();
  const items = tc.items.filter((it) => it.str?.trim() && Math.abs(it.transform[1]) < 0.01 && Math.abs(it.transform[2]) < 0.01)
    .map((it) => ({ s: it.str, x: it.transform[4], y: it.transform[5], w: it.width, size: Math.abs(it.transform[3]) || 10 }));
  items.sort((a, b) => b.y - a.y || a.x - b.x);
  const rows = [];
  for (const it of items) {
    const r = rows[rows.length - 1];
    if (r && Math.abs(r.y - it.y) < Math.min(r.size, it.size) * 0.5) r.items.push(it); else rows.push({ y: it.y, size: it.size, items: [it] });
  }
  for (const r of rows) { // merge pieces that are really one cell
    r.items.sort((a, b) => a.x - b.x);
    r.cells = [];
    for (const it of r.items) {
      const c = r.cells[r.cells.length - 1];
      const gap = c ? it.x - c.x1 : Infinity;
      if (c && gap < it.size * 0.9) { c.s += (gap > it.size * 0.12 && !c.s.endsWith(' ') && !it.s.startsWith(' ') ? ' ' : '') + it.s; c.x1 = Math.max(c.x1, it.x + it.w); }
      else r.cells.push({ s: it.s, x0: it.x, x1: it.x + it.w });
    }
  }
  // columns: x ranges that are empty in every multi-cell row separate the columns
  const multi = rows.filter((r) => r.cells.length > 1);
  const spans = (multi.length ? multi : rows).flatMap((r) => r.cells.map((c) => [c.x0, c.x1])).sort((a, b) => a[0] - b[0]);
  const cols = [];
  for (const [a, b] of spans) {
    const c = cols[cols.length - 1];
    if (c && a <= c[1] + 1) c[1] = Math.max(c[1], b); else cols.push([a, b]);
  }
  const colOf = (x) => { let best = 0; for (let i = 0; i < cols.length; i++) if (x >= cols[i][0] - 2) best = i; return best; };
  return rows.map((r) => {
    const out = [];
    for (const c of r.cells) { const i = colOf(c.x0); out[i] = out[i] ? out[i] + ' ' + c.s.trim() : c.s.trim(); }
    return out;
  });
}

function sheetXML(rows, style) {
  const widths = [];
  const body = rows.map((r, ri) => `<row r="${ri + 1}">` + r.map((v, ci) => {
    if (v == null || v === '') return '';
    widths[ci] = Math.max(widths[ci] || 8, Math.min(60, v.length + 2));
    const ref = colName(ci) + (ri + 1), n = asNumber(v, style);
    return n != null ? `<c r="${ref}"><v>${n}</v></c>` : `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
  }).join('') + '</row>').join('');
  const cols = widths.length ? '<cols>' + [...widths].map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w || 8}" customWidth="1"/>`).join('') + '</cols>' : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${cols}<sheetData>${body}</sheetData></worksheet>`;
}

export async function toXLSX(sheets) {
  const zip0 = new (await JSZip())();
  const zip = { file: (n, d) => zip0.file(n, d, { createFolders: false }) };
  const names = new Set();
  const safe = (n) => { let s = n.replace(/[\\/?*[\]:]/g, ' ').slice(0, 28) || 'Sheet'; let k = s, i = 2; while (names.has(k.toLowerCase())) k = s + ' ' + i++; names.add(k.toLowerCase()); return k; };
  const list = sheets.map((s, i) => ({ ...s, name: safe(s.name), id: i + 1 }));
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${list.map((s) => `<Override PartName="/xl/worksheets/sheet${s.id}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`);
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  zip.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${list.map((s) => `<sheet name="${esc(s.name)}" sheetId="${s.id}" r:id="rId${s.id}"/>`).join('')}</sheets></workbook>`);
  zip.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${list.map((s) => `<Relationship Id="rId${s.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${s.id}.xml"/>`).join('')}<Relationship Id="rId${list.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  zip.file('xl/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs></styleSheet>`);
  const style = numberStyle(list.flatMap((s) => s.rows.flat()).filter(Boolean));
  list.forEach((s) => zip.file(`xl/worksheets/sheet${s.id}.xml`, sheetXML(s.rows, style)));
  return zip0.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', compression: 'DEFLATE' });
}

export async function mount(root, tool) {
  let ctx, mode = 'one';
  const ui = shell(root, {
    actionLabel: t({ id: 'Ubah ke Excel', en: 'Convert to Excel' }),
    panelTitle: t({ id: 'Susunan sheet', en: 'Sheets' }),
    run: async () => {
      const pages = [];
      for (let i = 1; i <= ctx.doc.numPages; i++) pages.push(await pageRows(await ctx.doc.getPage(i)));
      const cells = pages.flat().length;
      if (!cells) throw new UserError(t({ id: 'PDF ini tidak punya teks. Kalau hasil scan, jalankan OCR dulu.', en: 'This PDF has no text. If it is a scan, run OCR first.' }));
      const sheets = mode === 'one'
        ? [{ name: stem(ctx.file.name), rows: pages.flatMap((r, i) => (i ? [[], ...r] : r)) }]
        : pages.map((rows, i) => ({ name: t({ id: 'Halaman {n}', en: 'Page {n}' }, { n: i + 1 }), rows }));
      return { files: [{ name: stem(ctx.file.name) + '.xlsx', data: await toXLSX(sheets), type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }],
        summary: t({ id: '{r} baris dari {p} halaman masuk ke Excel. Periksa kolomnya, karena tabel yang rumit bisa bergeser.', en: '{r} rows from {p} pages went into Excel. Check the columns, as complex tables can shift.' }, { r: cells, p: pages.length }) };
    },
  });
  singlePdf(ui, tool, (c) => {
    ctx = c;
    ui.opts.append(
      seg([['one', t({ id: 'Satu sheet', en: 'One sheet' })], ['pages', t({ id: 'Sheet per halaman', en: 'Sheet per page' })]], mode, (v) => (mode = v)),
      h('p', { class: 'note' }, t({ id: 'Kolom dibaca dari posisi teks. Angka seperti 1.250.000 atau 12,5 otomatis menjadi angka di Excel.', en: 'Columns are read from text positions. Numbers like 1,250,000 or 12.5 become real numbers in Excel.' })));
    ui.stage.append(pageGrid({ pages: c.pages, mode: 'view' }).el);
    ui.setReady(true);
  });
}
