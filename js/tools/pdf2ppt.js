import { h, t, stem, JSZip, renderPage } from '../core.js';
import { shell, seg, pageGrid } from '../ui.js';
import { singlePdf } from './_single.js';

const NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
const rels = (list) => `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${list.map(([id, type, target]) => `<Relationship Id="${id}" Type="${type.startsWith('http') ? type : REL + type}" Target="${target}"/>`).join('')}</Relationships>`;
const emptyTree = '<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';

const THEME = `${XML}<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="PDFDika"><a:themeElements><a:clrScheme name="PDFDika"><a:dk1><a:srgbClr val="000000"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="131B3A"/></a:dk2><a:lt2><a:srgbClr val="F3F5FA"/></a:lt2><a:accent1><a:srgbClr val="1F3FD1"/></a:accent1><a:accent2><a:srgbClr val="FFC52E"/></a:accent2><a:accent3><a:srgbClr val="2E9E6B"/></a:accent3><a:accent4><a:srgbClr val="C2264B"/></a:accent4><a:accent5><a:srgbClr val="565E80"/></a:accent5><a:accent6><a:srgbClr val="7A90FF"/></a:accent6><a:hlink><a:srgbClr val="1F3FD1"/></a:hlink><a:folHlink><a:srgbClr val="565E80"/></a:folHlink></a:clrScheme><a:fontScheme name="PDFDika"><a:majorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="PDFDika"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`;

/** slides: [{jpg: Uint8Array, w, h}] in points. */
export async function toPPTX(slides) {
  const zip0 = new (await JSZip())();
  const zip = { file: (n, d) => zip0.file(n, d, { createFolders: false }) };
  const EMU = 12700;
  const first = slides[0];
  const scale = 12192000 / (Math.max(first.w, first.h) * EMU); // longest side 13.33 in
  const cx = Math.round(first.w * EMU * scale), cy = Math.round(first.h * EMU * scale);

  zip.file('[Content_Types].xml', `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpeg" ContentType="image/jpeg"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/><Override PartName="/ppt/presProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presProps+xml"/><Override PartName="/ppt/viewProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.viewProps+xml"/><Override PartName="/ppt/tableStyles.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.tableStyles+xml"/>${slides.map((_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('')}</Types>`);
  zip.file('_rels/.rels', rels([['rId1', 'officeDocument', 'ppt/presentation.xml']]));
  zip.file('ppt/presentation.xml', `${XML}<p:presentation ${NS} saveSubsetFonts="1"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 10}"/>`).join('')}</p:sldIdLst><p:sldSz cx="${cx}" cy="${cy}"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`);
  zip.file('ppt/_rels/presentation.xml.rels', rels([['rId1', 'slideMaster', 'slideMasters/slideMaster1.xml'], ['rId2', 'theme', 'theme/theme1.xml'], ['rId3', 'presProps', 'presProps.xml'], ['rId4', 'viewProps', 'viewProps.xml'], ['rId5', 'tableStyles', 'tableStyles.xml'], ...slides.map((_, i) => [`rId${i + 10}`, 'slide', `slides/slide${i + 1}.xml`])]));
  zip.file('ppt/presProps.xml', `${XML}<p:presentationPr ${NS}/>`);
  zip.file('ppt/viewProps.xml', `${XML}<p:viewPr ${NS}/>`);
  zip.file('ppt/tableStyles.xml', `${XML}<a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"/>`);
  zip.file('ppt/theme/theme1.xml', THEME);
  zip.file('ppt/slideMasters/slideMaster1.xml', `${XML}<p:sldMaster ${NS}><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>${emptyTree}</p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>`);
  zip.file('ppt/slideMasters/_rels/slideMaster1.xml.rels', rels([['rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml'], ['rId2', 'theme', '../theme/theme1.xml']]));
  zip.file('ppt/slideLayouts/slideLayout1.xml', `${XML}<p:sldLayout ${NS} type="blank" preserve="1"><p:cSld name="Blank">${emptyTree}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`);
  zip.file('ppt/slideLayouts/_rels/slideLayout1.xml.rels', rels([['rId1', 'slideMaster', '../slideMasters/slideMaster1.xml']]));
  slides.forEach((s, i) => {
    const k = Math.min(cx / (s.w * EMU), cy / (s.h * EMU));
    const w = Math.round(s.w * EMU * k), hh = Math.round(s.h * EMU * k);
    const x = Math.round((cx - w) / 2), y = Math.round((cy - hh) / 2);
    zip.file(`ppt/slides/slide${i + 1}.xml`, `${XML}<p:sld ${NS}><p:cSld>${emptyTree}<p:pic><p:nvPicPr><p:cNvPr id="2" name="Page ${i + 1}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${hh}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`);
    zip.file(`ppt/slides/_rels/slide${i + 1}.xml.rels`, rels([['rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml'], ['rId2', 'image', `../media/page${i + 1}.jpeg`]]));
    zip0.file(`ppt/media/page${i + 1}.jpeg`, s.jpg, { createFolders: false, compression: 'STORE' });
  });
  return zip0.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', compression: 'DEFLATE' });
}

export async function mount(root, tool) {
  let ctx, dpi = 150;
  const ui = shell(root, {
    actionLabel: t({ id: 'Ubah ke PowerPoint', en: 'Convert to PowerPoint' }),
    panelTitle: t({ id: 'Kualitas slide', en: 'Slide quality' }),
    run: async () => {
      const slides = [];
      for (let i = 1; i <= ctx.doc.numPages; i++) {
        const vp = (await ctx.doc.getPage(i)).getViewport({ scale: 1 });
        const canvas = await renderPage(ctx.doc, i, (vp.width * dpi / 72) / Math.min(window.devicePixelRatio || 1, 2));
        const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.9));
        slides.push({ jpg: new Uint8Array(await blob.arrayBuffer()), w: vp.width, h: vp.height });
      }
      return { files: [{ name: stem(ctx.file.name) + '.pptx', data: await toPPTX(slides), type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }],
        summary: t({ id: '{n} halaman menjadi {n} slide.', en: '{n} pages became {n} slides.' }, { n: slides.length }) };
    },
  });
  singlePdf(ui, tool, (c) => {
    ctx = c;
    ui.opts.append(
      seg([[110, t({ id: 'Ringan', en: 'Light' })], [150, t({ id: 'Standar', en: 'Standard' })], [220, t({ id: 'Tajam', en: 'Sharp' })]], dpi, (v) => (dpi = v)),
      h('p', { class: 'note' }, t({ id: 'Setiap halaman menjadi satu slide bergambar, persis seperti aslinya. Cocok untuk presentasi; teks di slide tidak bisa diedit.', en: 'Each page becomes one picture slide that looks exactly like the original. Good for presenting; slide text is not editable.' })));
    ui.stage.append(pageGrid({ pages: c.pages, mode: 'view' }).el);
    ui.setReady(true);
  });
}
