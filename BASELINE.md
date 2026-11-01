# NewsAgg: Automated News Aggregation, NLP-Based Sentiment and Topic Classification, and Topic Insights Dashboard

NewsAgg：自動化新聞聚合、以 NLP 進行情緒與主題分類，以及主題洞察儀表板

## Patokan desain dan data

Baseline: 10 September 2026. Sumber proyek: D:/Website.

Alamat publik terakhir diverifikasi pada 12 September 2026:
https://charging-separate-satellite-atom.trycloudflare.com/.
Alamat sebelumnya, https://viking-necessary-terry-barry.trycloudflare.com/, sudah kedaluwarsa.
Tunnel lama review-egg-tim-specialty berhenti dikenali Cloudflare (Error 1016).
Container aktif newsagg-tunnel memakai HTTP/2 ke origin yang sama, http://host.docker.internal:80.
Container lama disimpan dalam keadaan berhenti sebagai newsagg-tunnel-backup-20260910.
TryCloudflare adalah Quick Tunnel untuk pengembangan: alamat acak dapat berganti dan tidak memiliki SLA/masa aktif yang dijamin.

## Identitas

- Logo disalin dari D:/logo-mark.png ke client/public/logo-mark.png tanpa perubahan gambar.
- BrandLogo.tsx adalah komponen bersama untuk header, sidebar, footer, dan autentikasi.
- Tipografi Nunito (Latin), dengan Noto Sans TC/SC untuk teks Mandarin.
- Kontras teks pendukung disesuaikan untuk mode gelap; deskripsi yang identik dengan judul tidak diulang.
- Logo: navy, struktur putih, node emerald / abu-abu / merah.
- Jalankan client/scripts/generate-brand-assets.py untuk memperbarui favicon, PWA, Apple icon, dan gambar share.

## Tata letak kategori

- Semua delapan kategori memakai grid NewsCard.tsx dengan gambar per card; bukan daftar panjang. Ini preferensi terbaru pengguna.
- All Categories dan setiap kategori memakai headline carousel. Pada halaman kategori,
  carousel hanya menampilkan berita dari kategori yang sedang aktif.
- Loading konten menggunakan ContentSkeleton.tsx (card, hero, artikel, dan panel), mendukung mode gelap dan reduced motion. Pagination mempertahankan card yang sudah dimuat.
- CategoryLens.tsx menampilkan distribusi sumber dari sampel artikel terbaru. Ukuran sampel selalu tertulis; angka tidak boleh diklaim sebagai total arsip.
- Statistik agregat tetap berasal dari API stats.
- Jangan menambahkan angka simulasi, tebakan subtopik dari kata bahasa Inggris, atau data pengisi.
- Views/likes/interactions simulasi telah dinonaktifkan karena belum ada pengukuran nyata.
- Filter kata kunci hanya membuang fragmen navigasi yang diketahui; tidak mengarang kata kunci pengganti.

## Asal kategori

- AI category: artikel memiliki skor label model; skor topik bukan ukuran kebenaran berita.
- Publisher category: kategori dipetakan dari rubrik/feed penerbit. Yahoo Taiwan menggunakan skip_zero_shot=True.
- Skor hanya ditampilkan di detail artikel bila tersedia; jangan mengubah skor yang tidak tersedia menjadi 100%.
- Perubahan kategori tidak menampilkan sementara artikel dari kategori sebelumnya.

## Menjalankan dan menerapkan perubahan

1. Dari client/: npm run typecheck, npm test, npm run build.
2. Dari akar proyek: docker compose up -d --build --no-deps client.
3. Situs lokal: http://localhost/ melalui IIS, yang meneruskan frontend ke port 8080 dan API ke port 3000.
4. Jalankan SHOW-PUBLIC-URL.ps1 untuk alamat tunnel aktif. URL TryCloudflare bersifat sementara dan dapat berganti saat tunnel dibuat ulang.
5. Periksa situs publik, kategori, favicon, serta mode terang/gelap setelah perubahan.

Jangan menaruh secret atau file .env di dokumen/arsip yang dibagikan. Baseline ini menjelaskan kode sumber, bukan salinan database.

## Verifikasi

Typecheck dan build produksi lulus. Suite pengujian yang ada: 4 tes lulus.
Situs publik memuat data aktual. Layout kategori diperiksa pada desktop dan lebar ponsel 390 px, termasuk mode gelap.
