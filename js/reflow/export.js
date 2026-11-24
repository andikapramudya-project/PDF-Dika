// Exporters for reflowed books: EPUB 3, DOCX, and a phone-sized PDF.
import { runsToHTML, headingText } from './reader.js';

const xesc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'pdfdika-' + Date.now());
const plain = (b) => headingText(b);

// ---------------- EPUB ----------------
export async function toEPUB(book, JSZip, { cover } = {}) {
  const zip0 = new JSZip();
  const zip = { file: (n, d, o) => zip0.file(n, d, { createFolders: false, ...o }), generateAsync: (o) => zip0.generateAsync(o) };
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file('META-INF/container.xml', '<?xml version="1.0" encoding="UTF-8"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
  const id = 'urn:uuid:' + uuid();
  const lang = book.lang || 'id';
  const css = `body{font-family:serif;line-height:1.55;margin:0 4%}h1,h2,h3{line-height:1.2;margin:1.6em 0 .6em;page-break-after:avoid}h1{font-size:1.6em}h2{font-size:1.3em}h3{font-size:1.1em}p{margin:0 0 .8em;text-align:left;hyphens:auto;-webkit-hyphens:auto}p.q{font-style:italic}sup{font-size:.65em;line-height:0}hr{border:0;text-align:center;margin:1.6em 0}hr:after{content:"* * *"}figure{margin:1em 0;text-align:center}img{max-width:100%;height:auto}`;
  zip.file('OEBPS/style.css', css);
  const manifest = ['<item id="css" href="style.css" media-type="text/css"/>', '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>', '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>'];
  const spine = [];
  const navItems = []; const ncx = [];
  let img = 0, hid = 0;
  if (cover) {
    zip.file('OEBPS/images/cover.jpg', cover.blob);
    manifest.push('<item id="cover-img" href="images/cover.jpg" media-type="image/jpeg" properties="cover-image"/>');
    zip.file('OEBPS/cover.xhtml', xhtml('Cover', lang, `<div style="text-align:center"><img src="images/cover.jpg" alt="" style="max-height:95vh"/></div>`));
    manifest.push('<item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>');
    spine.push('<itemref idref="cover" linear="no"/>');
  }
  for (let c = 0; c < book.chapters.length; c++) {
    const ch = book.chapters[c]; const file = `ch${String(c + 1).padStart(3, '0')}.xhtml`;
    const body = [];
    for (const b of ch.blocks) {
      if (b.type === 'h') { const hidS = 'h' + (++hid); body.push(`<h${b.level} id="${hidS}">${runsToHTML(b.runs)}</h${b.level}>`); if (b.level <= 2) { navItems.push({ file, id: hidS, level: b.level, text: plain(b) }); } }
      else if (b.type === 'p') body.push(`<p${b.quote ? ' class="q"' : ''}>${runsToHTML(b.runs, b.quote)}</p>`);
      else if (b.type === 'hr') body.push('<hr/>');
      else if (b.type === 'img') { const n = `images/img${++img}.jpg`; zip.file('OEBPS/' + n, b.blob); manifest.push(`<item id="img${img}" href="${n}" media-type="image/jpeg"/>`); body.push(`<figure><img src="${n}" alt=""/></figure>`); }
    }
    zip.file('OEBPS/' + file, xhtml(ch.title, lang, body.join('\n').replace(/<br>/g, '<br/>')));
    manifest.push(`<item id="c${c + 1}" href="${file}" media-type="application/xhtml+xml"/>`);
    spine.push(`<itemref idref="c${c + 1}"/>`);
    if (!navItems.some((n) => n.file === file)) navItems.push({ file, id: null, level: 1, text: ch.title });
  }
  const navList = navItems.map((n) => `<li><a href="${n.file}${n.id ? '#' + n.id : ''}">${xesc(n.text)}</a></li>`).join('');
  zip.file('OEBPS/nav.xhtml', `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${lang}" xml:lang="${lang}"><head><title>${xesc(book.title)}</title></head><body><nav epub:type="toc" id="toc"><h1>${lang === 'id' ? 'Daftar isi' : 'Contents'}</h1><ol>${navList}</ol></nav></body></html>`);
  zip.file('OEBPS/toc.ncx', `<?xml version="1.0" encoding="UTF-8"?><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head><meta name="dtb:uid" content="${id}"/></head><docTitle><text>${xesc(book.title)}</text></docTitle><navMap>${navItems.map((n, i) => `<navPoint id="n${i + 1}" playOrder="${i + 1}"><navLabel><text>${xesc(n.text)}</text></navLabel><content src="${n.file}${n.id ? '#' + n.id : ''}"/></navPoint>`).join('')}</navMap></ncx>`);
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  zip.file('OEBPS/content.opf', `<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="${lang}"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="bookid">${id}</dc:identifier><dc:title>${xesc(book.title || 'Untitled')}</dc:title>${book.author ? `<dc:creator>${xesc(book.author)}</dc:creator>` : ''}<dc:language>${lang}</dc:language><meta property="dcterms:modified">${now}</meta>${cover ? '<meta name="cover" content="cover-img"/>' : ''}</metadata><manifest>${manifest.join('')}</manifest><spine toc="ncx">${spine.join('')}</spine></package>`);
  return zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip', compression: 'DEFLATE' });
}
function xhtml(title, lang, body) {
  return `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" lang="${lang}" xml:lang="${lang}"><head><title>${xesc(title)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head><body>${body}</body></html>`;
}

// ---------------- DOCX ----------------
export async function toDOCX(book, JSZip) {
  const zip0 = new JSZip();
  const zip = { file: (n, d, o) => zip0.file(n, d, { createFolders: false, ...o }), generateAsync: (o) => zip0.generateAsync(o) };
  const rels = []; let rid = 1, img = 0;
  const run = (r) => `<w:r><w:rPr>${r.b ? '<w:b/>' : ''}${r.i ? '<w:i/>' : ''}${r.sup ? '<w:vertAlign w:val="superscript"/>' : ''}</w:rPr>${r.t.split('\n').map((x) => `<w:t xml:space="preserve">${xesc(x)}</w:t>`).join('<w:br/>')}</w:r>`;
  const body = [];
  if (book.title) body.push(`<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr>${run({ t: book.title })}</w:p>`);
  for (const ch of book.chapters) for (const b of ch.blocks) {
    if (b.type === 'h') body.push(`<w:p><w:pPr><w:pStyle w:val="Heading${b.level}"/></w:pPr>${b.runs.map(run).join('')}</w:p>`);
    else if (b.type === 'p') body.push(`<w:p>${b.quote ? '<w:pPr><w:pStyle w:val="Quote"/></w:pPr>' : ''}${b.runs.map(run).join('')}</w:p>`);
    else if (b.type === 'hr') body.push(`<w:p><w:pPr><w:jc w:val="center"/></w:pPr>${run({ t: '* * *' })}</w:p>`);
    else if (b.type === 'img') {
      const n = ++img; const r = 'rId' + (++rid);
      zip.file(`word/media/image${n}.jpg`, b.blob);
      rels.push(`<Relationship Id="${r}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image${n}.jpg"/>`);
      const maxW = 5943600; // 6.5in in EMU
      const cx = Math.min(maxW, Math.round(b.w / 2 * 9525)); const cy = Math.round(cx * b.h / b.w);
      body.push(`<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${n}" name="Picture ${n}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${n}" name="image${n}.jpg"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${r}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`);
    }
  }
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>');
  zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>${rels.join('')}</Relationships>`);
  zip.file('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${xesc(book.title || '')}</dc:title><dc:creator>${xesc(book.author || '')}</dc:creator><dc:language>${book.lang || 'id'}</dc:language></cp:coreProperties>`);
  const lang = book.lang === 'en' ? 'en-US' : 'id-ID';
  const st = (id, name, rpr, ppr = '', based = 'Normal') => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="${based}"/><w:next w:val="Normal"/><w:qFormat/><w:pPr>${ppr}</w:pPr><w:rPr>${rpr}</w:rPr></w:style>`;
  zip.file('word/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia" w:cs="Georgia"/><w:sz w:val="23"/><w:lang w:val="${lang}"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>${st('Title', 'Title', '<w:b/><w:sz w:val="48"/>', '<w:spacing w:after="360"/>')}${st('Heading1', 'heading 1', '<w:b/><w:sz w:val="36"/>', '<w:keepNext/><w:spacing w:before="480" w:after="200"/><w:outlineLvl w:val="0"/>')}${st('Heading2', 'heading 2', '<w:b/><w:sz w:val="30"/>', '<w:keepNext/><w:spacing w:before="360" w:after="160"/><w:outlineLvl w:val="1"/>')}${st('Heading3', 'heading 3', '<w:b/><w:sz w:val="26"/>', '<w:keepNext/><w:spacing w:before="280" w:after="120"/><w:outlineLvl w:val="2"/>')}${st('Quote', 'Quote', '', '<w:ind w:left="567" w:right="567"/>')}</w:styles>`);
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><w:body>${body.join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`);
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', compression: 'DEFLATE' });
}

// ---------------- Phone-sized PDF ----------------
export async function toPhonePDF(book, pdfLib, safe) {
  const { PDFDocument, StandardFonts, rgb } = pdfLib;
  const doc = await PDFDocument.create();
  doc.setTitle(book.title || ''); if (book.author) doc.setAuthor(book.author); doc.setLanguage(book.lang || 'id');
  const F = {
    r: await doc.embedFont(StandardFonts.TimesRoman), i: await doc.embedFont(StandardFonts.TimesRomanItalic),
    b: await doc.embedFont(StandardFonts.TimesRomanBold), bi: await doc.embedFont(StandardFonts.TimesRomanBoldItalic),
  };
  const fontOf = (r) => (r.b && r.i ? F.bi : r.b ? F.b : r.i ? F.i : F.r);
  const W = 315, H = 560, M = 24, TOP = 30, BOTTOM = 34, CW = W - 2 * M;
  const ink = rgb(0.12, 0.12, 0.14);
  let page, y, pageNo = 0;
  const newPage = () => {
    page = doc.addPage([W, H]); y = H - TOP; pageNo++;
    const n = String(pageNo); page.drawText(n, { x: W / 2 - F.r.widthOfTextAtSize(n, 8) / 2, y: 16, size: 8, font: F.r, color: rgb(0.5, 0.5, 0.55) });
  };
  newPage();
  const paragraph = (runs, size, lh, { first = false, gapAfter = size * 0.7, keepWithNext = false } = {}) => {
    // break runs into words that keep their style
    const words = [];
    for (const r of runs) for (const part of safe(r.t).split(/(\n|[^\S\n]+)/)) if (part) words.push(part === '\n' ? { br: true } : { t: part, f: fontOf(r), sz: r.sup ? size * 0.65 : size, sup: r.sup });
    const lines = []; let line = [], w = 0;
    for (const wd of words) {
      if (wd.br) { if (line.length) lines.push(line); line = []; w = 0; continue; }
      const ww = wd.f.widthOfTextAtSize(wd.t, wd.sz);
      if (/^\s+$/.test(wd.t)) { if (line.length) { line.push({ ...wd, w: ww }); w += ww; } continue; }
      if (w + ww > CW && line.length) { while (line.length && /^\s+$/.test(line[line.length - 1].t)) line.pop(); lines.push(line); line = []; w = 0; }
      line.push({ ...wd, w: ww }); w += ww;
    }
    if (line.length) lines.push(line);
    const need = keepWithNext ? lh * (lines.length + 3) : lh * Math.min(2, lines.length);
    if (y - need < BOTTOM && y < H - TOP - 1) newPage();
    if (first) y -= size * 0.3;
    for (const ln of lines) {
      if (y - lh < BOTTOM) newPage();
      y -= lh; let x = M;
      for (const wd of ln) { if (!/^\s+$/.test(wd.t)) page.drawText(wd.t, { x, y: wd.sup ? y + size * 0.35 : y, size: wd.sz, font: wd.f, color: ink }); x += wd.w; }
    }
    y -= gapAfter;
  };
  for (const ch of book.chapters) {
    for (const b of ch.blocks) {
      if (b.type === 'h') {
        const size = { 1: 17, 2: 14.5, 3: 12.5 }[b.level];
        if (b.level === 1 && y < H - TOP - 1) newPage();
        y -= b.level === 1 ? 18 : 10;
        paragraph(b.runs.map((r) => ({ ...r, b: true })), size, size * 1.25, { gapAfter: size * 0.6, keepWithNext: true });
      } else if (b.type === 'p') paragraph(b.runs, 11, 16);
      else if (b.type === 'hr') { if (y - 30 < BOTTOM) newPage(); y -= 22; page.drawText('*  *  *', { x: W / 2 - F.r.widthOfTextAtSize('*  *  *', 11) / 2, y, size: 11, font: F.r, color: ink }); y -= 12; }
      else if (b.type === 'img') {
        const im = await doc.embedJpg(new Uint8Array(await b.blob.arrayBuffer()));
        let w = Math.min(CW, b.w / 2), h = w * b.h / b.w;
        const maxH = H - TOP - BOTTOM; if (h > maxH) { h = maxH; w = h * b.w / b.h; }
        if (y - h - 8 < BOTTOM) newPage();
        y -= h + 6; page.drawImage(im, { x: (W - w) / 2, y, width: w, height: h }); y -= 10;
      }
    }
  }
  return doc.save();
}
