# PDFDika

Alat PDF yang bekerja sepenuhnya di browser. File tidak pernah diunggah ke server.

**Situs:** https://andikapramudya-project.github.io/PDF-Dika/

## Fitur tahap 1
**Fitur unggulan: Mode baca & EPUB.** Menyusun ulang PDF (buku, modul, jurnal 2 kolom) agar nyaman dibaca di HP, lalu menyimpannya sebagai HTML offline, EPUB, Word (DOCX), atau PDF ukuran HP.

Alat lain: gabung, pisah, atur halaman, putar, hapus, ambil halaman, balik urutan, sisipkan halaman kosong, beberapa halaman per lembar, tanda tangan, watermark, nomor halaman, tambah teks, tambah gambar, edit properti, hapus metadata, gambar ke PDF, PDF ke gambar, PDF ke teks, PDF ke Word.

Tahap 2 berikutnya: PDF ke Excel/PowerPoint, OCR, kompres, kunci/buka kunci, sensor, potong, dan lainnya.

## Teknologi
- Situs statis tanpa proses build: HTML, CSS, JavaScript modul.
- [pdf-lib](https://pdf-lib.js.org/) untuk membuat dan mengubah PDF, [PDF.js](https://mozilla.github.io/pdf.js/) untuk pratinjau dan teks, [JSZip](https://stuk.github.io/jszip/) untuk ZIP. Semua disimpan di `vendor/`, tidak memakai CDN.
- Service worker (`sw.js`) membuat situs bisa dipakai offline dan dipasang sebagai aplikasi (PWA).
- Bahasa Indonesia dan Inggris, mode gelap, ramah ponsel.

## Menjalankan secara lokal
```
python3 -m http.server 8000
```
Lalu buka http://localhost:8000.

Jika mengubah file, naikkan `VERSION` di `sw.js` agar pengunjung mendapat versi baru.
