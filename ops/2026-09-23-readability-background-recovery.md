# Koreksi readability, upload background, dan recovery origin — 23 September

## Menggantikan keputusan UI sebelumnya

Permintaan pengguna: jangan hapus reading grade/Flesch/SMOG; perbaiki penyebab 0. Background juga harus menerima upload foto.

### Readability

- Ketiga metrik kembali ditampilkan melalui ReadabilityPanel, termasuk glossary.
- Penyebab nilai palsu: newsAPI memakai Number(null) || 0 dan fallback ?? 0. Sekarang null dipertahankan; numeric string dibaca sebagai angka, dan nilai Flesch/grade nol yang benar tetap dipertahankan.
- Penyebab data lama: upsert scraper memperbarui word count/reading time, tetapi tidak tiga skor. Ketiganya sekarang ikut diperbarui.
- Pipeline secara eksplisit memakai formula Inggris untuk teks Inggris; bahasa lain/CJK/teks kosong menghasilkan null, bukan nilai sekolah AS yang tidak relevan.
- SMOG dihitung untuk minimal 30 kalimat dalam pipeline baru. Library bisa menghasilkan skor pada sampel lebih pendek, tetapi dokumentasinya menjelaskan keterbatasan validitas sampel di bawah 30 kalimat: https://github.com/textstat/textstat#the-smog-index
- Panel menandai bahasa lain sebagai Not applicable; missing/SMOG sentinel sebagai Unavailable. Angka dari original English tidak diklaim sebagai hasil pengukuran teks Mandarin terjemahan.
- repair_readability.py default dry-run, --apply hanya mengganti tiga skor artikel feed saat ini. Update memakai guard content_hash agar tidak menempelkan skor lama pada konten yang berubah saat scraper berjalan.
- Hasil live: 288 artikel diperiksa (195 en, 93 lainnya); 112 diperbarui. Tidak ada isi artikel/bookmark dihapus. Ini bukan backfill semua arsip.
- API contoh eb4a011dc01fe63a: Flesch 54.94, grade 10.54, SMOG null. Contoh zh-TW 384e1b1b31f7c90d: ketiga skor null.

### Background profil

- Pilihan preset tetap ada, ditambah Upload image dan Remove image.
- File JPG/PNG/WebP maksimal 10 MB. Browser men-decode lalu centre-crop 3:1, resize hingga 1200×400 (fallback lebih kecil), re-encode dan membatasi data URL 150.000 karakter sebelum dikirim. Metadata file tidak ikut disimpan.
- Server memvalidasi panjang, tipe raster dan signature file; SVG/remote URL/fake-WebP ditolak. Update menggunakan userId dari sesi, bukan ID dari request.
- Kolom additive profile_background_image (migrasi 009) sudah diterapkan. Foto tersimpan pada akun, ikut respons /me/login dan tampil juga pada public profile.
- Pemilihan preset atau Remove image mengosongkan foto akun, bukan menghapus file asli pengguna.

## Insiden 1016 pukul 17:00 Asia/Taipei

- Origin lama chose-meant-newsletter-eng.trycloudflare.com tidak lagi ter-resolve (NXDOMAIN).
- Pipeline sudah membuat pengganti employment-bio-mothers-fraser.trycloudflare.com, tetapi wrangler deploy dalam proses jadwal gagal autentikasi non-interaktif. Worker tetap menunjuk origin lama.
- Worker disambungkan ke tunnel pengganti yang sudah hidup, tanpa membuat tunnel tambahan atau mengubah alamat publik newsagg.sentsis.workers.dev. Health publik kembali 200, DB up.
- UPDATE-STABLE-ORIGIN.ps1 sekarang mencoba deployment origin yang sama maksimal tiga kali untuk kegagalan sementara. Jalur command() tanpa stdin yang dipakai scheduler diuji langsung dan berhasil setelah recovery.
- Kredensial Cloudflare tetap dependensi eksternal. Retry bukan jaminan ketika OAuth dicabut/refresh gagal terus; token deploy khusus untuk jadwal dapat diperlukan. Tidak ada token baru yang dibuat atau keamanan akun yang dilemahkan.
- Referensi 1016: https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-1xxx-errors/error-1016/

## Verifikasi dan batas

- 56 tes backend, 19 frontend, 45 scraper lulus (120 total pada koreksi ini); typecheck, lint dan image build client/server/scraper lulus.
- Lima pemeriksaan API live lulus. Tidak ada email tambahan dikirim.
- Container ingestion run 22ab8ef5-7b2c-4b12-8a58-38c857699e8d tetap berjalan; tidak direstart saat deployment server/client. Run ini memakai image awal pukul 17:00, sehingga perubahan kalkulasi scraper berlaku pada run baru berikutnya. Backfill memperbaiki artikel yang sudah ada pada saat diperiksa.
- Upload file end-to-end melalui browser pengguna dan visual layout belum diverifikasi; cakupan upload adalah tes validasi API dan crop/re-encode di frontend. Google authorization error adalah isu terpisah yang belum dinyatakan selesai.
