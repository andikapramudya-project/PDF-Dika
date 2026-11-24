// OCR helpers shared by the OCR tool and reading mode.
import { ocrWorker, renderPage } from '../core.js';

/** Recognize one canvas; returns words with boxes in canvas pixels plus paragraphs. */
export async function recognizeCanvas(worker, canvas) {
  const { data } = await worker.recognize(canvas, {}, { text: true, blocks: true });
  const words = [], paras = [];
  for (const b of data.blocks || []) for (const p of b.paragraphs || []) {
    const lines = (p.lines || []).map((l) => ({ text: l.text.trim(), h: l.bbox.y1 - l.bbox.y0, words: l.words || [] }));
    for (const l of lines) for (const w of l.words) if (w.text.trim() && w.confidence > 20) words.push({ text: w.text, ...w.bbox });
    if (lines.length) paras.push(lines);
  }
  return { words, paras, text: data.text, width: canvas.width, height: canvas.height };
}

/** OCR each page of a pdf.js document at ~200 DPI. onPage(i, total) reports progress. */
export async function ocrDocument(pdf, langs, onPage, onLoad) {
  const worker = await ocrWorker(langs, onLoad);
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const vp = page.getViewport({ scale: 1 });
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const canvas = await renderPage(pdf, i, (vp.width * 200 / 72) / dpr);
    pages.push({ ...(await recognizeCanvas(worker, canvas)), vw: vp.width, vh: vp.height });
    onPage?.(i, pdf.numPages);
  }
  return pages;
}

/** Turn OCR paragraphs into reading-mode blocks (headings guessed from line height). */
export function ocrToBlocks(pages) {
  const heights = pages.flatMap((p) => p.paras.flatMap((ls) => ls.map((l) => l.h))).sort((a, b) => a - b);
  const body = heights[Math.floor(heights.length / 2)] || 20;
  const blocks = [];
  for (const pg of pages) for (const lines of pg.paras) {
    const h = lines.reduce((s, l) => s + l.h, 0) / lines.length;
    let text = '';
    for (const l of lines) {
      if (/[\p{L}]-$/u.test(text) && /^\p{Ll}/u.test(l.text)) {
        // keep the hyphen for Indonesian reduplication (berpura-pura, anak-anak)
        const frag = (text.match(/(\p{L}+)-$/u) || [])[1]?.toLowerCase() || '';
        const next = (l.text.match(/^\p{L}+/u) || [''])[0].toLowerCase();
        text = (frag && next && (frag === next || frag.endsWith(next))) ? text + l.text : text.slice(0, -1) + l.text;
      }
      else text += (text ? ' ' : '') + l.text;
    }
    text = text.replace(/\s+/g, ' ').trim();
    if (!text || /^[\divxlc]{1,4}$/i.test(text)) continue; // page numbers
    if (h > body * 1.35 && text.length < 120) blocks.push({ type: 'h', level: h > body * 1.8 ? 1 : 2, runs: [{ t: text }] });
    else {
      const last = blocks[blocks.length - 1];
      // a paragraph cut by a page break continues when it did not end a sentence
      if (last?.type === 'p' && last._open && /^\p{Ll}/u.test(text)) last.runs[0].t += ' ' + text;
      else blocks.push({ type: 'p', runs: [{ t: text }] });
    }
    const b = blocks[blocks.length - 1];
    if (b.type === 'p') b._open = !/[.!?:"”)]$/.test(b.runs[0].t);
  }
  blocks.forEach((b) => delete b._open);
  return blocks;
}
