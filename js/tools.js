// Tool catalogue. status 'ready' tools have a module in js/tools/<id>.js; 'soon' tools are stage 2.

export const CATS = [
  { id: 'organize', color: 'var(--c-organize)', name: { id: 'Atur halaman', en: 'Organize pages' } },
  { id: 'edit', color: 'var(--c-edit)', name: { id: 'Edit & tanda tangan', en: 'Edit & sign' } },
  { id: 'convert', color: 'var(--c-convert)', name: { id: 'Konversi', en: 'Convert' } },
  { id: 'optimize', color: 'var(--c-optimize)', name: { id: 'Optimasi', en: 'Optimize' } },
  { id: 'security', color: 'var(--c-security)', name: { id: 'Keamanan & privasi', en: 'Security & privacy' } },
];

const ic = {
  merge: '<path d="M6 4v5a4 4 0 0 0 4 4h4a4 4 0 0 1 4 4v3"/><path d="M18 4v5a4 4 0 0 1-4 4"/><path d="M15 17l3 3 3-3"/>',
  split: '<path d="M12 3v18" stroke-dasharray="2 3"/><rect x="3" y="5" width="6" height="14" rx="1.5"/><rect x="15" y="5" width="6" height="14" rx="1.5"/>',
  rotate: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  organize: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="9" rx="1.5"/><rect x="3" y="15" width="7" height="6" rx="1.5"/><path d="M14 18h7M18 15l3 3-3 3"/>',
  del: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M9 13h6"/>',
  extract: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4"/><path d="M14 3v5h5v4"/><path d="M15 16h6M18 13l3 3-3 3"/>',
  reverse: '<path d="M7 4v16M4 17l3 3 3-3"/><path d="M17 20V4M14 7l3-3 3 3"/>',
  blank: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M12 11v6M9 14h6"/>',
  nup: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 3v18M3 12h18"/>',
  img2pdf: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
  pdf2img: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><circle cx="10" cy="12" r="1.5"/><path d="M17 18l-4-4-5 5"/>',
  text: '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>',
  watermark: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  numbers: '<path d="M4 6h2v6M4 12h4"/><path d="M12 6h8M12 12h8M12 18h8"/><path d="M4 16h3l-3 4h3"/>',
  sign: '<path d="M3 17c3-1 4-8 6-8s0 9 3 9 3-5 5-5 2 3 4 3"/><path d="M3 21h18"/>',
  addtext: '<path d="M4 7V5h11v2M9.5 5v12M7 17h5"/><path d="M17 12v8M13 16h8"/>',
  addimg: '<rect x="3" y="5" width="13" height="13" rx="2"/><path d="M16 14l-4-4-9 8"/><path d="M19 3v6M16 6h6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  word: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M8 12l1.5 6 2.5-5 2.5 5L16 12"/>',
  sheet: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16"/>',
  slides: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M12 16v4M8 20h8"/>',
  ocr: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M8 10h8M8 14h5"/>',
  compress: '<path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  unlock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 7.5-2"/>',
  redact: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><rect x="8" y="11" width="8" height="3" fill="currentColor"/><path d="M8 17h5"/>',
  crop: '<path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/>',
  gray: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18" /><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>',
  flatten: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  compare: '<rect x="3" y="4" width="7" height="16" rx="1.5"/><rect x="14" y="4" width="7" height="16" rx="1.5"/><path d="M10 9h4M10 15h4"/>',
  scrub: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M9 13l2 2 4-4"/>',
  images: '<rect x="7" y="3" width="14" height="14" rx="2"/><path d="M3 7v12a2 2 0 0 0 2 2h12"/><circle cx="12" cy="8" r="1.5"/><path d="M21 13l-4-4-6 6"/>',
  resize: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M14 10l7-7M15 3h6v6M10 14l-7 7M3 15v6h6"/>',
  form: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h4M7 14h10"/><rect x="14" y="8" width="3" height="2"/>',
  header: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 7h16M4 17h16"/>',
  reflow: '<rect x="3" y="3" width="8" height="18" rx="1.5"/><path d="M5.5 7h3M5.5 10h3M5.5 13h3"/><rect x="14" y="6" width="7" height="15" rx="1.5"/><path d="M16 10h3M16 13h3M16 16h2"/><path d="M11 9.5l3 0"/>',
  bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
};

const T = (id, cat, icon, name, desc, extra = {}) => ({ id, cat, icon: ic[icon], name, desc, status: 'ready', ...extra });
const S = (id, cat, icon, name, desc) => ({ id, cat, icon: ic[icon], name, desc, status: 'soon' });

export const TOOLS = [
  // Organize
  T('merge', 'organize', 'merge', { id: 'Gabung PDF', en: 'Merge PDF' }, { id: 'Satukan beberapa PDF dan atur urutannya.', en: 'Combine several PDFs and set their order.' }, { accept: '.pdf,application/pdf', multiple: true, kw: 'combine join satukan' }),
  T('split', 'organize', 'split', { id: 'Pisah PDF', en: 'Split PDF' }, { id: 'Pecah per halaman, per rentang, atau setiap N halaman.', en: 'Split by page, by range, or every N pages.' }, { accept: '.pdf,application/pdf', kw: 'pecah bagi' }),
  T('organize', 'organize', 'organize', { id: 'Atur halaman', en: 'Organize pages' }, { id: 'Seret untuk mengurutkan, putar, gandakan, atau hapus halaman.', en: 'Drag to reorder, rotate, duplicate or remove pages.' }, { accept: '.pdf,application/pdf', multiple: true, kw: 'urutkan reorder susun' }),
  T('rotate', 'organize', 'rotate', { id: 'Putar PDF', en: 'Rotate PDF' }, { id: 'Putar satu halaman atau semuanya 90, 180, 270 derajat.', en: 'Turn one page or all of them by 90, 180 or 270 degrees.' }, { accept: '.pdf,application/pdf', kw: 'rotasi' }),
  T('delete', 'organize', 'del', { id: 'Hapus halaman', en: 'Delete pages' }, { id: 'Pilih halaman yang tidak perlu lalu buang.', en: 'Pick the pages you do not need and remove them.' }, { accept: '.pdf,application/pdf', kw: 'remove buang' }),
  T('extract', 'organize', 'extract', { id: 'Ambil halaman', en: 'Extract pages' }, { id: 'Simpan halaman pilihan sebagai PDF baru.', en: 'Save chosen pages as a new PDF.' }, { accept: '.pdf,application/pdf', kw: 'ekstrak select' }),
  T('reverse', 'organize', 'reverse', { id: 'Balik urutan', en: 'Reverse order' }, { id: 'Urutkan halaman dari terakhir ke pertama.', en: 'Order pages from last to first.' }, { accept: '.pdf,application/pdf', kw: 'terbalik' }),
  T('blank', 'organize', 'blank', { id: 'Sisipkan halaman kosong', en: 'Insert blank pages' }, { id: 'Tambahkan halaman kosong di posisi yang kamu pilih.', en: 'Add empty pages where you need them.' }, { accept: '.pdf,application/pdf', kw: 'kosong insert' }),
  T('nup', 'organize', 'nup', { id: 'Beberapa halaman per lembar', en: 'Pages per sheet' }, { id: 'Cetak 2, 4, atau 6 halaman dalam satu lembar.', en: 'Fit 2, 4 or 6 pages onto one sheet.' }, { accept: '.pdf,application/pdf', kw: 'n-up print cetak' }),
  S('crop', 'organize', 'crop', { id: 'Potong PDF', en: 'Crop PDF' }, { id: 'Pangkas margin halaman.', en: 'Trim page margins.' }),
  S('resize', 'organize', 'resize', { id: 'Ubah ukuran halaman', en: 'Resize pages' }, { id: 'Sesuaikan ke A4, Letter, atau ukuran lain.', en: 'Fit pages to A4, Letter or a custom size.' }),

  // Edit & sign
  T('sign', 'edit', 'sign', { id: 'Tanda tangan PDF', en: 'Sign PDF' }, { id: 'Gambar, ketik, atau unggah tanda tangan lalu tempatkan.', en: 'Draw, type or upload a signature and place it.' }, { accept: '.pdf,application/pdf', kw: 'ttd signature paraf' }),
  T('watermark', 'edit', 'watermark', { id: 'Tambah watermark', en: 'Add watermark' }, { id: 'Cap teks di setiap halaman, miring atau berulang.', en: 'Stamp text on every page, diagonal or tiled.' }, { accept: '.pdf,application/pdf', kw: 'cap tanda air' }),
  T('numbers', 'edit', 'numbers', { id: 'Nomor halaman', en: 'Page numbers' }, { id: 'Beri nomor halaman dan pilih letaknya.', en: 'Number pages and choose where they go.' }, { accept: '.pdf,application/pdf', kw: 'penomoran page number' }),
  T('addtext', 'edit', 'addtext', { id: 'Tambah teks', en: 'Add text' }, { id: 'Ketik teks baru di mana saja pada halaman.', en: 'Type new text anywhere on a page.' }, { accept: '.pdf,application/pdf', kw: 'tulis edit teks' }),
  T('addimage', 'edit', 'addimg', { id: 'Tambah gambar', en: 'Add image' }, { id: 'Tempel logo, stempel, atau foto ke halaman.', en: 'Place a logo, stamp or photo on a page.' }, { accept: '.pdf,application/pdf', kw: 'logo stempel cap' }),
  T('metadata', 'edit', 'info', { id: 'Edit properti', en: 'Edit properties' }, { id: 'Ubah judul, penulis, subjek, dan kata kunci.', en: 'Change title, author, subject and keywords.' }, { accept: '.pdf,application/pdf', kw: 'metadata judul author' }),
  S('header', 'edit', 'header', { id: 'Header & footer', en: 'Header & footer' }, { id: 'Tambahkan teks di atas atau bawah setiap halaman.', en: 'Add text above or below every page.' }),
  S('forms', 'edit', 'form', { id: 'Isi formulir', en: 'Fill in forms' }, { id: 'Isi kolom formulir PDF.', en: 'Complete fillable PDF fields.' }),
  S('bookmarks', 'edit', 'bookmark', { id: 'Tambah bookmark', en: 'Add bookmarks' }, { id: 'Buat daftar isi yang bisa diklik.', en: 'Build a clickable table of contents.' }),

  // Convert
  T('reflow', 'convert', 'reflow', { id: 'Mode baca & EPUB', en: 'Reading mode & EPUB' }, { id: 'Susun ulang PDF agar nyaman dibaca di HP. Simpan sebagai HTML offline atau EPUB.', en: 'Reflow a PDF for comfortable phone reading. Save as offline HTML or EPUB.' }, { accept: '.pdf,application/pdf', featured: true, kw: 'reflow epub html baca ebook buku kindle novel mobile hp' }),
  T('pdf2word', 'convert', 'word', { id: 'PDF ke Word', en: 'PDF to Word' }, { id: 'Ubah PDF menjadi DOCX yang bisa diedit.', en: 'Turn a PDF into an editable DOCX.' }, { accept: '.pdf,application/pdf', kw: 'docx word doc' }),
  T('img2pdf', 'convert', 'img2pdf', { id: 'Gambar ke PDF', en: 'Images to PDF' }, { id: 'Ubah JPG, PNG, atau WebP menjadi satu PDF.', en: 'Turn JPG, PNG or WebP into one PDF.' }, { accept: 'image/jpeg,image/png,image/webp,image/gif,image/bmp,.jpg,.jpeg,.png,.webp', multiple: true, kw: 'jpg png foto' }),
  T('pdf2img', 'convert', 'pdf2img', { id: 'PDF ke gambar', en: 'PDF to images' }, { id: 'Simpan setiap halaman sebagai JPG atau PNG.', en: 'Save every page as JPG or PNG.' }, { accept: '.pdf,application/pdf', kw: 'jpg png foto' }),
  T('pdf2text', 'convert', 'text', { id: 'PDF ke teks', en: 'PDF to text' }, { id: 'Ambil semua teks ke file .txt.', en: 'Pull all text into a .txt file.' }, { accept: '.pdf,application/pdf', kw: 'txt salin copy' }),
  S('pdf2excel', 'convert', 'sheet', { id: 'PDF ke Excel', en: 'PDF to Excel' }, { id: 'Ambil tabel ke XLSX.', en: 'Pull tables into XLSX.' }),
  S('pdf2ppt', 'convert', 'slides', { id: 'PDF ke PowerPoint', en: 'PDF to PowerPoint' }, { id: 'Satu slide untuk setiap halaman.', en: 'One slide per page.' }),
  S('ocr', 'convert', 'ocr', { id: 'OCR PDF', en: 'OCR PDF' }, { id: 'Jadikan hasil scan bisa dicari dan disalin.', en: 'Make scans searchable and selectable.' }),
  S('extractimg', 'convert', 'images', { id: 'Ambil gambar', en: 'Extract images' }, { id: 'Simpan gambar yang ada di dalam PDF.', en: 'Save the pictures inside a PDF.' }),

  // Optimize
  S('compress', 'optimize', 'compress', { id: 'Kompres PDF', en: 'Compress PDF' }, { id: 'Perkecil ukuran file dengan kualitas pilihan.', en: 'Make the file smaller at a quality you pick.' }),
  S('grayscale', 'optimize', 'gray', { id: 'PDF hitam putih', en: 'Grayscale PDF' }, { id: 'Ubah halaman berwarna menjadi abu-abu.', en: 'Convert colour pages to gray.' }),
  S('flatten', 'optimize', 'flatten', { id: 'Ratakan PDF', en: 'Flatten PDF' }, { id: 'Kunci isian formulir agar tidak berubah.', en: 'Lock form fields so they cannot change.' }),
  S('compare', 'optimize', 'compare', { id: 'Bandingkan PDF', en: 'Compare PDFs' }, { id: 'Lihat perbedaan teks antara dua PDF.', en: 'See text differences between two PDFs.' }),

  // Security
  T('scrub', 'security', 'scrub', { id: 'Hapus metadata', en: 'Remove metadata' }, { id: 'Bersihkan judul, penulis, dan info aplikasi pembuat.', en: 'Clear title, author and creator details.' }, { accept: '.pdf,application/pdf', kw: 'privasi bersihkan' }),
  S('protect', 'security', 'lock', { id: 'Kunci PDF', en: 'Protect PDF' }, { id: 'Tambahkan kata sandi untuk membuka file.', en: 'Add a password to open the file.' }),
  S('unlock', 'security', 'unlock', { id: 'Buka kunci PDF', en: 'Unlock PDF' }, { id: 'Hapus kata sandi yang kamu ketahui.', en: 'Remove a password you know.' }),
  S('redact', 'security', 'redact', { id: 'Sensor PDF', en: 'Redact PDF' }, { id: 'Hitamkan teks sensitif secara permanen.', en: 'Black out sensitive text for good.' }),
];

export const byId = (id) => TOOLS.find((x) => x.id === id);
export const catOf = (id) => CATS.find((c) => c.id === id);
