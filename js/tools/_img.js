// Helpers for reading image XObjects straight from a pdf-lib document.

/** Undo PNG row predictors (Predictor >= 10) for 8-bit samples. */
function unpng(src, rowBytes, bpp, rows) {
  const out = new Uint8Array(rowBytes * rows);
  let prev = new Uint8Array(rowBytes);
  for (let y = 0, p = 0; y < rows && p < src.length; y++) {
    const ft = src[p++];
    const row = out.subarray(y * rowBytes, (y + 1) * rowBytes);
    for (let x = 0; x < rowBytes; x++, p++) {
      const a = x >= bpp ? row[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0, v = src[p] || 0;
      if (ft === 0) row[x] = v;
      else if (ft === 1) row[x] = v + a;
      else if (ft === 2) row[x] = v + b;
      else if (ft === 3) row[x] = v + ((a + b) >> 1);
      else { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); row[x] = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); }
    }
    prev = row;
  }
  return out;
}

export function filterOf(dict, lib) {
  const f = dict.lookup(lib.PDFName.of('Filter'));
  if (!f) return '';
  if (f instanceof lib.PDFArray) return f.size() === 1 ? f.lookup(0).toString() : 'multi';
  return f.toString();
}

/** Number of colour components, or 0 when the colour space is not plain RGB / Gray. */
export function components(dict, lib) {
  const cs = dict.lookup(lib.PDFName.of('ColorSpace'));
  if (!cs) return 0;
  const s = cs.toString();
  if (s === '/DeviceRGB' || s === '/CalRGB') return 3;
  if (s === '/DeviceGray' || s === '/CalGray') return 1;
  if (cs instanceof lib.PDFArray && cs.lookup(0)?.toString() === '/ICCBased') {
    const n = cs.lookup(1)?.dict?.lookup(lib.PDFName.of('N'))?.asNumber?.();
    return n === 3 || n === 1 ? n : 0;
  }
  return 0;
}

/** Decoded 8-bit pixels of a Flate (or unfiltered) RGB/Gray image, or null if unsupported. */
export function rawPixels(obj, lib) {
  const { PDFName, decodePDFRawStream } = lib;
  const d = obj.dict;
  const w = d.lookup(PDFName.of('Width'))?.asNumber?.(), hh = d.lookup(PDFName.of('Height'))?.asNumber?.();
  const bpc = d.lookup(PDFName.of('BitsPerComponent'))?.asNumber?.();
  const f = filterOf(d, lib);
  const n = components(d, lib);
  if (!w || !hh || bpc !== 8 || !n || (f && f !== '/FlateDecode')) return null;
  let raw;
  try { raw = f ? decodePDFRawStream(obj).decode() : obj.contents; } catch { return null; }
  const parms = d.lookup(PDFName.of('DecodeParms'));
  const pred = parms?.lookup?.(PDFName.of('Predictor'))?.asNumber?.() || 1;
  if (pred >= 10) raw = unpng(raw, w * n, n, hh);
  else if (pred !== 1) return null;
  if (raw.length < w * hh * n) return null;
  return { w, h: hh, n, data: raw };
}

/** Raw pixels to an ImageData (RGBA). */
export function toImageData({ w, h, n, data }, gray = false) {
  const img = new ImageData(w, h);
  for (let i = 0, j = 0; i < w * h; i++, j += n) {
    const p = i * 4;
    let r = data[j], g = data[j + (n === 3 ? 1 : 0)], b = data[j + (n === 3 ? 2 : 0)];
    if (gray) r = g = b = Math.round(r * 0.299 + g * 0.587 + b * 0.114);
    img.data[p] = r; img.data[p + 1] = g; img.data[p + 2] = b; img.data[p + 3] = 255;
  }
  return img;
}

export const isImage = (obj, lib) => obj instanceof lib.PDFRawStream && obj.dict.lookup(lib.PDFName.of('Subtype'))?.toString() === '/Image';
