# NewsAgg — perbaikan kualitas dan pengujian

## Update 23 September 2026

Koreksi sore: reading grade/Flesch/SMOG **dikembalikan**, null tidak lagi dipalsukan menjadi nol, background mendukung upload gambar, dan origin 1016 dipulihkan. Lihat [laporan koreksi](ops/2026-09-23-readability-background-recovery.md); laporan ini menggantikan keputusan penghapusan metrik/preset-only sebelumnya.

Perbaikan UI, background akun, deduplikasi, terjemahan dan target scraper sudah dideploy. 141 tes lulus. Laporan terbaru beserta batas verifikasi dan blocker Google OAuth: [ops/2026-09-23-ui-feed-fixes.md](ops/2026-09-23-ui-feed-fixes.md). Bagian bertanggal lebih lama di bawah adalah catatan historis.

Tanggal verifikasi: 20 September 2026. Proyek final berjalan di laptop dengan Docker dan Cloudflare Quick Tunnel. Dokumen ini bukan klaim bahwa sistem bebas bug atau memiliki SLA produksi.

## Model dan layanan yang benar-benar digunakan

| Fitur | Model / metode | Lokasi |
| --- | --- | --- |
| Sentimen multilingual | `cardiffnlp/twitter-xlm-roberta-base-sentiment` | Python lokal |
| Sentimen finansial berbahasa Inggris | `ProsusAI/finbert` | Python lokal |
| Klasifikasi kategori | `MoritzLaurer/mDeBERTa-v3-base-mnli-xnli`, FP32 | Python lokal |
| Pemeriksaan kategori ambigu | `openai/gpt-oss-120b`, melalui kunci Groq yang sudah ada | API; maksimum 60 percobaan per proses scraper, circuit breaker saat gagal |
| Entitas orang/organisasi/lokasi | `Davlan/xlm-roberta-base-ner-hrl` | Python lokal |
| Toksisitas teks Inggris | `unitary/toxic-bert` | Python lokal; bukan model toksisitas multilingual |
| Embedding multilingual baru | `BAAI/bge-m3`, 1.024 dimensi | Docker `local-ai`, CPU, tidak membuka port publik |
| Ringkasan | Pemilihan kalimat TF-IDF atau BGE-M3 + MMR, versi v4 | Lokal; kutipan ekstraktif, bukan ringkasan abstraktif LLM |
| Chat artikel | Groq `openai/gpt-oss-120b`, fallback `openai/gpt-oss-20b` | API, konteks dari artikel server dan sitasi |
| Terjemahan | Gemini `gemini-3.5-flash-lite`; Lingva hanya untuk teks pendek | API, cache berdasarkan isi dan versi pipeline |
| Keyword Mandarin | Jieba TF-IDF | Python lokal |
| Memori preferensi | Integrasi Mem0 yang sudah ada | Layanan memori; model internalnya tidak ditentukan di repositori |

“Lokal” berarti Python berjalan di container pada komputer ini. Model diunduh sekali ke volume `hf_cache`; bukan layanan inference Hugging Face berbayar. BGE menyediakan pencarian semantik lintas bahasa dan pemilihan kutipan. Vektor saat ini dicache secara terbatas di memori; tabel `article_chunks` yang disiapkan belum dipakai sebagai indeks retrieval persisten.

Tidak ada paket berbayar atau API key baru yang dibuat. Kunci Groq/Gemini yang sudah ada digunakan; kuota dan status billing tetap ditentukan akun provider. Saat kuota habis, sistem menampilkan fallback/kegagalan yang jujur, bukan membeli kapasitas. HF token opsional hanya membantu akses unduhan. Jangan menaruh secret di variabel `VITE_*`.

FP32 mDeBERTa penting: Transformers 5 dapat mengikuti dtype checkpoint FP16. [Pembuat model menyatakan FP16 tidak didukung](https://huggingface.co/MoritzLaurer/mDeBERTa-v3-base-mnli-xnli). Fixture regresi memastikan konfigurasi FP32 tidak hilang.

## Kebijakan kualitas berita

- Feed dan statistik hanya memakai artikel `structured-v3`, body berstruktur, `feed_eligible`, tanggal publikasi dalam 30 hari terakhir dan tidak lebih dari 2 jam di masa depan. Artikel arsip dan bookmark tidak dihapus.
- Tanggal publikasi asli didahulukan dari JSON-LD/metadata; tanggal scrape atau tanggal modifikasi tidak dipakai untuk menyamarkan artikel lama sebagai baru.
- Scraper memberi batas per sumber/kategori, mendahulukan kategori yang kurang terwakili, menyaring duplikasi, dan mencatat kekurangan kuota. Jumlah yang persis sama tidak dijanjikan jika sumber tidak menerbitkan berita yang layak.
- Body menyimpan paragraf, subjudul, daftar, kutipan, dan caption; rekomendasi Al Jazeera `more-on` dan artikel tambahan Yahoo infinite-scroll dibuang.
- Charset HTML digunakan ketika header HTTP tidak menyatakannya (memperbaiki simbol mata uang BBC); anak elemen caption tidak diduplikasi, `data-block` promosi disaring, dan variasi ukuran foto BBC dikenali sebagai foto yang sama.
- Gambar diperiksa tipe MIME dan dimensi; parameter URL dipertahankan. Browser menunjukkan fallback saat sumber tidak dapat diakses. Gambar eksternal tetap bisa kedaluwarsa atau menolak hotlink.
- Ringkasan memilih kalimat dari seluruh body yang tersimpan, termasuk bagian tengah/akhir. Desimal dan singkatan seperti `Dr.` tidak dipotong. Artikel yang melebihi batas 25.000 karakter ditandai `content_truncated`.
- Skor klasifikasi bukan akurasi fakta. Keputusan kategori Groq tidak diberi angka confidence buatan. Sentimen berita juga bukan penilaian kebenaran atau kredibilitas penerbit.

## UI dan chat

- Chat mengambang berada di atas bottom navbar pada mobile/tablet; panel chat berada di atas navigasi.
- Ketukan semua tab bawah, termasuk tab yang sedang aktif, mereset scroll ke atas.
- “Most relevant” dihapus; Posts menggunakan newest-first dan mempunyai kategori/filter.
- Hero image tidak dirender dua kali. Perubahan URL gambar memulihkan komponen yang sebelumnya gagal.
- Halaman arsip yang belum lolos ekstraksi baru menampilkan peringatan kualitas, bukan dianggap artikel terverifikasi.
- Riwayat chat dipisahkan menurut pengguna dan artikel. Login tetap diperlukan; pengujian tidak melewati autentikasi.
- Retrieval menggabungkan BM25 (token utuh dan bobot kelangkaan istilah) dengan ranking semantik. Paragraf pendek digabung sampai batas 1.400 karakter agar subjudul dan fakta penjelasnya tidak tercerai. Saat AI tidak tersedia, fallback dinyatakan sebagai kutipan sumber, bukan jawaban AI.
- Terjemahan body panjang diproses per chunk. Jika provider gagal, UI tidak menandai teks asli sebagai terjemahan sukses. Terjemahan saat ini mempertahankan paragraf, bukan seluruh tipe blok DOM asli.

## Google Sign-In dan tunnel

Alamat aktif mulai 22 September: **https://newsagg.sentsis.workers.dev**. Pemilik
mengganti subdomain akun menjadi `sentsis`; konfigurasi server, CORS, link email
berikutnya dan deploy Worker telah disesuaikan. Error TLS awal hilang setelah
redeploy tanpa membuat tunnel baru. Origin Google OAuth perlu didaftarkan satu
kali dan sesi pada hostname lama tidak berpindah otomatis. Bukti login tanggal
20 September di bawah adalah riwayat untuk alamat lama, bukan verifikasi login
Google pada hostname baru.

Restart normal tidak lagi sengaja merotasi tunnel. Namun hostname Quick Tunnel tetap dapat berubah setelah tunnel dibuat ulang atau dihentikan provider. Google memerlukan origin yang terdaftar; cookie tidak dapat dipindahkan ke hostname acak lain.

Kode fixed-origin gratis berada di [deploy/stable-origin](deploy/stable-origin/README.md). Worker `*.workers.dev` mempertahankan alamat browser sambil meneruskan request ke Quick Tunnel yang berubah. `UPDATE-STABLE-ORIGIN.ps1` dipanggil saat startup/publish apabila `NEWSAGG_STABLE_URL` diisi.

**Worker dan login sudah diuji:** https://newsagg.riyakavajravesaka.workers.dev (20 September 2026). Akun Cloudflare telah diotorisasi pemilik; root `.env` dan server menggunakan alamat tetap. Pemilik menambahkan origin Google lalu login sendiri. Uji nyata membuat ulang container tunnel, mengganti hostname upstream, menjalankan helper pembaruan Worker, kemudian me-reload browser. Profil yang sama tetap masuk, status Google tetap "Connected for sign-in", dan sesi perangkat dari server tetap muncul tanpa login ulang. Lima pemeriksaan API publik juga lulus sesudah rotasi. Tidak perlu Google API key baru. Sesi aplikasi tetap memiliki masa berlaku tujuh hari.

Jika tunnel di-restart langsung dari Docker, di luar skrip startup/publish, jalankan `.\UPDATE-STABLE-ORIGIN.ps1` agar Worker menunjuk URL baru. Worker tidak dapat menemukan URL acak baru tanpa pembaruan ini. Pengguna harus selalu membuka alamat `workers.dev`, bukan URL sementara.

## Perintah verifikasi

```powershell
.\VERIFY-NEWSAGG.ps1
# Pemeriksaan cepat API aplikasi yang sedang berjalan:
.\VERIFY-API.ps1
.\VERIFY-API.ps1 -BaseUrl https://newsagg.sentsis.workers.dev
# Opsional, panggilan kecil ke provider memakai kunci yang sudah ada:
.\VERIFY-NEWSAGG.ps1 -LiveAI
# Canary scraper nyata: menulis berita yang lolos ke DB.
.\RUN-SCRAPER.ps1 -Target 1
# Workflow publish tanpa email, rotasi tunnel, atau scrape:
.\GITHUB-DAILY-PUBLISH.ps1 -DryRun -SkipScrape
# Mengirim SATU email nyata ke penerima eksplisit, tanpa mengubah jadwal/delivery stamp:
# Jalankan hanya setelah penerima menyetujui pengujian.
.\GITHUB-DAILY-PUBLISH.ps1 -TestEmailTo 'recipient@example.com'
# Pemeriksaan cleanup dan bahasa, TANPA penghapusan/perubahan:
docker compose --profile scraper run --rm scraper python cleanup.py --days 30
docker compose --profile scraper run --rm scraper python backfill_lang.py --source yahoo_tw --lang zh-TW
```

`/api/stats/scraper-status` menampilkan status run terakhir dan counter yang diizinkan, termasuk defisit tiap sumber/kategori. Status parsial bukan kuota yang terpenuhi. Jangan menjalankan cleanup dengan `--commit` hanya untuk mencoba workflow.

## Bukti pengujian dan batas yang tersisa

- Bukti siklus nyata 23 September 07.57: scraping kemarin selesai 21.54 dengan 0 error scraper/DB. Edisi 116 artikel dari 4 sumber/8 kategori dibekukan 04.30:04; email berisi 12 artikel terpilih memakai hostname `newsagg.sentsis.workers.dev`, tanpa hostname lama. SMTP menerima 01257166/68/69 pada 04.40:07/10/13, masing-masing 1 percobaan; status delivery `delivered` dan exit task 0. Tidak ada resend manual. Kuota liputan masih PARTIAL, bukan kegagalan pengiriman. Kedua jadwal aktif (ingestion 17.00, freeze 04.30, kirim 04.40); preflight SMTP/publik sehat. Inbox/Spam tiap penerima dan siklus malam kedua belum dikonfirmasi. Run kemarin masih memakai container lama; perbaikan kualitas hasil build 22 September dipakai oleh run baru berikutnya.

- Pembaruan 22 September 20.36: **132 tes lulus** (49 backend, 11 frontend, 39 scraper, 5 Worker, 28 pipeline/email), typecheck/lint/build serta API lokal lulus. Perbaikan: label lokal `sports`/`science and technology` dan sejenisnya, definisi fokus liputan untuk second opinion, konteks awal/tengah/akhir dengan batas token CJK, margin antar kategori, verifikasi tambahan kasus Science/game, pembagian kuota API antarpenerbit, dua putaran scraping yang memberi tiap pasangan sumber/kategori kesempatan awal maksimal 12 kandidat/2 artikel, dan diagnosis penolakan API yang lebih jelas. Ringkasan mengecualikan caption/subjudul; gambar dibatasi pada artikel utama, bukan artikel Yahoo lanjutan/rekomendasi; validasi publikasi memastikan blok reader cocok dengan body dan fallback gambar tidak menyimpan URL lama.
- Evaluasi model asli pada 10 contoh Inggris/Mandarin menghasilkan 10 label teratas sesuai harapan. Percobaan label panjang sebelumnya gagal (2/10) dan dibatalkan; bukan konfigurasi final. Ini smoke check kecil, bukan angka akurasi populasi. Artikel `49837d1be5bb226a` ditolak saat diaudit sebagai Science, kemudian diekstrak ulang dan lolos sebagai Lifestyle melalui model `openai/gpt-oss-120b`; API publik mengonfirmasi kategori, taxonomy `reporting-focus-v2`, ringkasan BGE-M3, dan gambar verified. ID/link tetap sama, tidak ada penghapusan atau email tambahan. Image scraper baru sudah dibangun; run besar yang dimulai 19.44 tetap memakai image lama sampai selesai. Hasil penuh/perataan dari run baru belum terbukti.

- Verifikasi terbaru 22 September 19.45: **121 tes lulus** (49 backend, 11 frontend, 28 scraper, 5 Worker, 28 pipeline/email), typecheck/lint/build dan lima pemeriksaan API lulus. Dua pengujian integrasi Neon memakai rollback; preflight SMTP dan website publik sehat tanpa mengirim email. Ini bukti kode dan koneksi saat diuji, bukan jaminan seluruh kuota kategori atau pengiriman Inbox sebelum 05.00.

- Pembaruan 22 September sore: arsitektur terbaru ada di `ops/LIVE-PUBLICATION.md` (menggantikan jadwal 00.05 di catatan historis di bawah). Satu Neon DB memakai staging terpisah; artikel tervalidasi langsung dipublikasikan, cache mengikuti revision DB. Jadwal Windows aktif: scrape 17.00, snapshot email immutable 04.30 esok hari, SMTP 04.40 untuk tiga penerima semula. Migrasi additive sudah diterapkan. Uji DB rollback-only membuktikan isolasi kandidat, publikasi atomic, dan snapshot tidak dapat diubah; tidak ada fixture atau email uji tersimpan/terkirim. Run awal memublikasikan 26 artikel sebelum proses Windows berhenti dengan 0xC000013A pada 19.38; pemicu penghentian belum terbukti. Retry terbatas sudah ditambahkan dan run kedua dimulai 19.44, memakai batas waktu run pertama 22.42. Siklus malam arsitektur baru belum selesai; jangan menganggap tiga Inbox sudah menerima email besok.

- Pembaruan 22 September 07.18: setelah laporan email PARTIAL, discovery diperbaiki agar halaman kategori tetap dicoba saat RSS belum menghasilkan kuota artikel yang lolos. Budget AI kategori sekarang dibagi per kategori, dan penolakan "belum terverifikasi" dibedakan dari kategori salah. Desain email diganti newsletter responsif; preview desktop/mobile diperiksa tanpa overflow, tidak ada email revisi terkirim. Suite terbaru 107 tes (47 backend, 11 frontend, 25 scraper, 5 Worker, 19 pipeline/email), typecheck/lint/build, lima cek API, dan preflight SMTP/publik lulus. Run penuh dengan recheck artikel tersimpan dimulai 07.14; hasil akhir masih pending, tetapi artikel Science mulai lolos pada log enrichment.

- Pembaruan 22 September: operasi harian sekarang mengikuti `ops/DAILY-PIPELINE.md`, bukan workflow email legacy. Windows `NewsAgg Daily Pipeline` mulai 00.05, scraper dibatasi sampai 04.25, dan pengiriman dimulai 04.40 Asia/Taipei. Task lama 05.00 dinonaktifkan. Penerima rutin: 01257166/01257168/01257169 di email.ntou.edu.tw. GitHub workflow sudah manual-only pada file lokal, tetapi perubahan remote belum dipush/diverifikasi.
- Suite terbaru: 47 backend + 11 frontend + 20 scraper + 5 Worker + 16 pipeline = 99 tes lulus. Typecheck/lint/build dan 5 pemeriksaan API publik lulus. Preflight SMTP/Neon/Docker/alamat publik juga lulus tanpa email tambahan. Run target-10 pertama benar-benar dipicu Windows pada 22 September 00.05; hasil akhir, durasi, penerimaan tiga Inbox, dan dua siklus malam masih perlu dibuktikan.
- Pipeline memakai manifest run yang sama, batas publikasi 48 jam, pengecualian artikel yang kedaluwarsa selama menunggu, status PARTIAL/FAILED yang eksplisit, serta ledger SMTP per penerima. Pemulihan tunnel kini menunggu propagasi DNS sebelum menganggap alamat publik gagal. Ini tidak menjadi jaminan layanan gratis atau Inbox sebelum 05.00.

- Backend, frontend, scraper, proxy Worker, typecheck, lint, dan build diuji. Pemeriksaan API mencakup tanggal/sort/deduplikasi feed, pagination, struktur dan bukti ringkasan, kategori Posts, serta penolakan chat tanpa login.
- Hasil suite: 47 tes backend, 11 frontend, 17 scraper, dan 5 Worker (80 total), ditambah 5 pemeriksaan API hidup. Backend ditambah dua tes regresi setelah uji chat akun nyata menemukan bagian akhir artikel tidak terambil. Workflow harian lulus dry-run; jumlah berita mengikuti jendela waktu berjalan. Pada 21 September 2026, satu email uji memakai template digest dan SMTP yang sama diterima server SMTP untuk penerima yang disetujui; penerimaan Inbox/Spam belum dikonfirmasi. Daftar penerima rutin dan delivery stamp tidak berubah.
- Canary terakhir: 28 artikel, 4 sumber, 26 insert dan 2 update, 0 error database. Semua 28 target sumber/kategori terkonfigurasi terpenuhi; 15 kandidat kategori tidak sesuai ditolak. Delapan kategori terwakili, masing-masing 3–4 artikel. Ini bukti satu run, bukan jaminan semua run selalu penuh.
- Startup Docker diuji langsung: container tunnel tetap sama setelah aplikasi dibangun dan dijalankan ulang.
- Audit visual terakhir menemukan charset/caption/promosi BBC; sesudah fix, batch BBC memperbaiki 14 artikel dan menahan 3 kandidat kategori tidak sesuai tanpa menghapus arsip. API artikel contoh kemudian mengonfirmasi tidak ada `Â£`, promosi, atau caption sebagai pembuka ringkasan. Galeri mobile hanya menampilkan satu versi foto hero; tombol Ask AI berakhir pada y=764, di atas navbar y=786 pada viewport 390×844.
- Smoke test Groq berhasil menjawab pertanyaan yang jawabannya hanya ada pada paragraf terakhir, dengan sitasi yang dikenali UI. Marker `【4】` dinormalisasi menjadi `[4]`.
- Uji browser dengan akun pemilik, setelah rotasi tunnel dan redeploy API: pertanyaan tentang bagian Watford awalnya gagal mengambil konteks. Sesudah perbaikan chunk packing/BM25, chatbot menjawab Alessio Dionisi, dua kemenangan dari delapan pertandingan, dan posisi ke-19; panel sitasi `[4]` memuat ketiga fakta tersebut. Pesan uji tetap berada pada riwayat chat artikel akun tersebut; tidak ada post publik yang dibuat.
- Smoke test Gemini berhasil menerjemahkan fixture ke Bahasa Indonesia dan mempertahankan tanggal akhir.
- BGE-M3 berhasil mengembalikan vektor 1.024 dimensi; fixture pertanyaan Indonesia memilih paragraf Inggris yang relevan dibanding dua pengalih.
- Audit npm dependency produksi pada client/server: 0 kerentanan yang dilaporkan saat pemeriksaan. Ini bukan audit keamanan menyeluruh.
- Browser diuji pada 390, 960, dan 1.440 px. Ketukan tab aktif terukur mengubah scroll dari 707 menjadi 0; filter kategori Posts juga berfungsi.
- Cleanup hanya dry-run: tidak ada artikel dihapus, backup Neon tidak dibuat. Email uji hanya dikirim ke satu penerima eksplisit, bukan ke daftar penerima rutin workflow.
- Artikel lama yang belum diekstrak ulang tidak masuk feed terverifikasi. URL arsip/bookmark tetap dapat diakses dan belum semuanya direkonstruksi dari halaman penerbit.
- Model dan kategori belum mempunyai evaluasi akurasi representatif atas dataset berlabel manusia. Tidak ada jaminan bebas halusinasi hanya karena jawaban memakai sitasi.
- Laptop, Docker, koneksi internet, batas layanan gratis, dan perubahan markup penerbit tetap menentukan ketersediaan. Login Google dan ketahanan sesi telah lolos satu uji rotasi nyata; bukan jaminan sesi tidak akan pernah kedaluwarsa atau provider tidak akan pernah meminta autentikasi lagi.
- Pada 21 September, Quick Tunnel kedaluwarsa di sisi provider (`Tunnel not found`, HTTP 530/1016). Preflight menghentikan email sebelum SMTP; setelah container tunnel dibuat ulang dan Worker diperbarui, email uji dikirim satu kali. Pencarian URL di skrip sekarang menyaring seluruh log yang tersedia, bukan hanya 150–200 baris terakhir yang dapat dipenuhi pesan retry. Tidak ada pemulihan otomatis terus-menerus jika provider mematikan tunnel di luar eksekusi skrip.
