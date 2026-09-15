# NewsAgg — GitHub Actions harian

Arsitektur:

- Pukul 03:00 Asia/Taipei: `.github/workflows/scraper.yml` menjalankan scraper
  pada runner cloud GitHub.
- Pukul 05:00 Asia/Taipei: `.github/workflows/newsagg-daily.yml` memanggil
  self-hosted runner Windows di laptop, membuat URL Cloudflare baru, membaca
  ringkasan database, dan mengirim email HTML.

Repository wajib dibuat **private** sebelum self-hosted runner diaktifkan.

## Pasang self-hosted runner

Di repository buka **Settings > Actions > Runners > New self-hosted runner**,
pilih **Windows x64**, lalu jalankan instruksi yang ditampilkan GitHub dari akun
Windows yang sama dengan akun Docker Desktop. Token runner bersifat sementara;
jangan kirim token lewat chat.

Runner dan Docker Desktop harus aktif agar tugas pukul 05:00 dapat berjalan.
Jika laptop mati/offline, tugas GitHub akan menunggu sampai runner kembali online.

## Secrets dan Variables

Buka **Settings > Secrets and variables > Actions**.

Secrets:

- `NEONDB_URL`: koneksi database untuk cloud scraper.
- `HF_TOKEN`: token Hugging Face (opsional, tetapi membantu download model).
- `SMTP_USER`: alamat Gmail pengirim.
- `SMTP_PASS`: Google App Password 16 karakter, bukan password login biasa.

Variables:

- `REPORT_EMAIL_TO`: daftar penerima dipisahkan koma, misalnya
  `01257166@email.ntou.edu.tw,anggota@example.com`.
- `MAIL_FROM`: alamat yang sama dengan `SMTP_USER` (opsional).
- `SMTP_HOST`: default `smtp.gmail.com`.
- `SMTP_PORT`: default `587`.

Ubah `REPORT_EMAIL_TO` kapan saja untuk mengganti penerima tanpa mengubah kode.
Untuk mengisi atau mengganti konfigurasi email tanpa menampilkan password,
jalankan `CONFIGURE-GITHUB-EMAIL.ps1` pada laptop ini.

## Tes manual

Di tab **Actions**, pilih workflow yang diinginkan lalu **Run workflow**.
Menjalankan workflow laporan benar-benar mengganti URL Cloudflare dan mengirim
email baru.
