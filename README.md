# CatatKu — GitHub Pages + PWA

## Struktur
- `index.html` = tampilan utama
- `css/style.css` = styling
- `js/config.js` = URL/API key
- `js/api.js` = komunikasi Google Apps Script
- `js/*` = fitur per modul
- `manifest.json` = PWA
- `service-worker.js` = cache/offline shell
- `assets/` = ikon PWA

## Upload ke GitHub
1. Upload semua isi folder ini ke repository GitHub.
2. Pastikan `index.html` ada di root repository.
3. Buka Settings → Pages.
4. Source: Deploy from a branch.
5. Pilih branch `main` dan folder `/ (root)`.
6. Simpan dan buka URL GitHub Pages.

## Catatan
API Google Apps Script tetap memakai URL dari proyek sebelumnya.
Service worker hanya mencache file aplikasi dari GitHub Pages dan tidak mencache API Google Apps Script.
