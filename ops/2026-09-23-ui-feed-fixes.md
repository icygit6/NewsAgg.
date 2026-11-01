# NewsAgg — hasil perbaikan 23 September 2026

## Sudah diterapkan pada website

- Coverage desk dihapus; kategori Business/Finance tetap memiliki Markets.
- Label AI category, sumber/skor klasifikasi, reading grade, Flesch dan SMOG dihapus dari tampilan. Analisis internal tetap dipertahankan.
- Background profil: enam preset warna, disimpan per akun di Neon. Bukan upload gambar. Migrasi 007 bersifat additive.
- Angka lama “AI models: 2” hanya menghitung model sentimen yang ditemukan di artikel: XLM-R dan FinBERT. Sekarang panel menjelaskan enam model NLP dalam pipeline beserta tugasnya. Ini inventaris konfigurasi, bukan klaim enam model selalu berjalan pada setiap artikel.
- Model NLP: CardiffNLP XLM-R sentiment, ProsusAI FinBERT, MoritzLaurer mDeBERTa multilingual NLI, Davlan XLM-R NER, BAAI BGE-M3, unitary toxic-BERT. Chat Groq dan terjemahan Gemini tidak dimasukkan dalam hitungan NLP lokal.
- Pilihan bahasa di artikel kini mengaktifkan terjemahan. Hasil bahasa/artikel sebelumnya tidak boleh ditampilkan pada artikel/target baru.
- Terjemahan panjang diproses per chunk, maksimal dua permintaan paralel per artikel dengan batas waktu; permintaan artikel identik digabung. Kegagalan/truncation tidak disimpan sebagai terjemahan sukses. Preview gagal tidak lagi memicu puluhan permintaan ulang Gemini.
- Back dari artikel memulihkan posisi daftar; navigasi lainnya kembali ke atas. Halaman feed yang masih di cache tidak dipindahkan oleh refetch otomatis saat kembali.
- Feed menghilangkan ID berulang antar-page. Query publik dan statistik menyaring body identik atau judul sama dari publisher sama dalam 24 jam; URL/ID/bookmark lama tidak dihapus. Migrasi 008 menambahkan indeks pencarian duplikat.
- Scraper mengarantina salinan alternate-URL baru, tanpa menimpa artikel valid yang sudah ada.
- Loading infinite scroll memakai indikator kecil dengan tinggi tetap, observer mengikuti area scroll utama, overflow container diperbaiki, animasi masuk kartu tambahan dikurangi.

## Kapasitas scraper dan email

Audit read-only: 147.3 MB database, 9.312 artikel termasuk arsip. Angka ini bukan kuota akun Neon.
Target naik 10 → 15 per pasangan sumber/kategori (maksimal 420 dari 28 pasangan yang dikonfigurasi). Waktu maksimal 210 menit, usia 48 jam dan syarat kualitas tetap berlaku; hasil aktual bisa kurang dan tidak dijamin seimbang.
Anggaran keselamatan internal 400 MiB, headroom 60 MiB; proses berhenti menambah kandidat sebelum kategori berikutnya ketika ambang tercapai. Ini bukan izin memenuhi database sampai batas paket. Tidak ada penghapusan otomatis atau backup.
Image scraper baru telah dibangun untuk jadwal 23 September 17:00 Asia/Taipei. Belum ada full ingestion baru sesudah perubahan ini.
Jadwal freeze 04:30 dan send 04:40 tetap. Preflight aktual memverifikasi SMTP, kesehatan origin publik dan tiga penerima; tidak mengirim email tambahan.

## Bukti pengujian

- 54 tes backend, 13 frontend, 41 scraper, 28 workflow/email, 5 Worker: total 141 lulus.
- Typecheck, lint dan build client/server lulus.
- Lima pemeriksaan API live lulus, termasuk feed, pagination, reader, posts dan auth chat.
- Integrasi staging/publication pada Neon: fixture hanya di transaksi rollback, termasuk penolakan duplikat dan update invalid. Tidak ada artikel uji yang dipublikasikan.
- Origin publik mengembalikan enam model NLP dan feed yang difilter; container server/client/tunnel sehat, tunnel tidak diganti.
- Terjemahan Inggris → Mandarin tradisional pada artikel `eb4a011dc01fe63a`: Gemini, cache miss, sekitar 6 detik, 609 karakter output sampai paragraf akhir. Ini smoke test, bukan evaluasi linguistik seluruh korpus.

## Belum selesai / batas verifikasi

- Google Sign-In: pengguna melaporkan “Access blocked: authorization error”. Client ID runtime frontend dan backend cocok. Belum ada kode detail error/screenshot, sehingga akar penyebab belum dapat dipastikan.
- Domain baru harus terdaftar di Authorized JavaScript origins OAuth client yang sama: `https://newsagg.sentsis.workers.dev`. Jika kode `access_denied`, periksa audience/test users; jangan melemahkan verifikasi token aplikasi. Tidak perlu membuat API key baru hanya karena rename domain.
- Referensi resmi: https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid
- Browser automation gagal inisialisasi di host (kernel assets os error 3). Login nyata dan pemeriksaan visual/responsif pascadeploy belum terverifikasi; tes frontend di atas menggunakan jsdom.
- Preservasi struktur heading/list hasil terjemahan penuh belum ditingkatkan: reader terjemahan masih merender paragraf teks, sedangkan artikel original memakai structured blocks.
- Duplikasi semantik lintas publisher dengan wording berbeda tidak disatukan; aturan sekarang sengaja konservatif agar liputan berbeda tidak terhapus.
- Hasil target 15 dan distribusi kategori perlu dinilai dari run berikutnya. Science masih langka pada audit; kapasitas lebih besar tidak dengan sendirinya memperbaiki ketersediaan sumber.
