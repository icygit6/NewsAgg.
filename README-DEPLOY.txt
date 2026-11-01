NEWSAGG - WINDOWS + DOCKER + CLOUDFLARE (GRATIS)
================================================
Panduan harian yang paling lengkap: START-RESTART-GUIDE.txt (bahasa Inggris).
Alamat publik tetap: https://newsagg.sentsis.workers.dev

ISI PROYEK
- client, server, scraper: source yang dibangun Docker
- docker-compose.yml: db (PostgreSQL lokal), server, client, local-ai, tunnel,
  dbviewer, dan scraper (profile terpisah)
- START/STOP/CHECK-NEWSAGG.ps1: operasi harian
- scripts\RUN-SCRAPER.ps1: menjalankan scraper secara manual
- ops\rebuild-live.mjs: menerbitkan perubahan kode ke situs live
- compose.env.example, server.env.example: template tanpa password atau API key

PERSYARATAN
1. Windows 10/11 64-bit dengan WSL2 dan Docker Desktop.
2. Isi .env root: NEWSAGG_DB_PASSWORD, NEWSAGG_DBVIEWER_PASSWORD, NEWSAGG_STABLE_URL.
3. Isi server/.env: SECRET_KEY, dan NEONDB_URL ke database lokal
   (postgres://newsagg:<password>@127.0.0.1:5433/newsagg) untuk skrip di host.
   API key AI dan SMTP boleh dikosongkan dahulu.

PERSIAPAN WINDOWS PERTAMA KALI
1. Klik kanan PowerShell > Run as Administrator.
2. Jalankan: Set-ExecutionPolicy -Scope Process Bypass
3. Jalankan: .\scripts\SETUP-WINDOWS.ps1
4. Restart Windows (skrip tidak melakukan restart otomatis).
5. Buka Docker Desktop dan tunggu sampai engine aktif.

MENJALANKAN
1. Dari D:\Website jalankan .\scripts\START-NEWSAGG.ps1.
2. Pada run pertama, skrip membuat .env dan server/.env dari template lalu berhenti.
   Isi nilai di atas, lalu jalankan scripts\START-NEWSAGG.ps1 lagi.
3. Buka http://localhost:8080 (lokal) atau alamat workers.dev (publik).
4. .\scripts\CHECK-NEWSAGG.ps1 memeriksa status; .\scripts\SHOW-PUBLIC-URL.ps1 menampilkan alamat.

ALAMAT PUBLIK
- Worker Cloudflare (deploy/stable-origin) memberi alamat workers.dev yang tetap dan
  meneruskan trafik ke Quick Tunnel di laptop. Alamat trycloudflare.com di belakangnya
  bisa berganti; task "NewsAgg Web Recovery" menyambungkan ulang Worker otomatis.
- Bila situs lokal jalan tetapi publik tidak: .\scripts\UPDATE-STABLE-ORIGIN.ps1

MEMASUKKAN UPDATE KODE
1. Proyek ini repository Git (GitHub: icygit6/NewsAgg). Ambil perubahan lewat Git,
   bukan copy/replace manual.
2. Jangan pernah menimpa .env atau server/.env; file itu berisi secret laptop server.
3. Jalankan node ops\rebuild-live.mjs (atau --check untuk melihat saja). Volume
   database tidak disentuh. Jangan menjalankan docker compose down -v.
4. Jalankan scripts\CHECK-NEWSAGG.ps1 dan uji login, bookmark, halaman artikel, serta /health.

CATATAN KEAMANAN
- Jangan kirim .env atau server/.env yang sudah terisi melalui Git atau grup chat.
- Port 3000, 5433, 8080, dan 8081 hanya dibuka di 127.0.0.1; akses publik lewat tunnel.
- Backup database ada di backups\ dan berisi data akun; simpan salinan kedua di
  folder yang Anda kendalikan (lihat START-RESTART-GUIDE.txt).

PERINTAH PENTING
- Start/update : .\scripts\START-NEWSAGG.ps1
- Status       : .\scripts\CHECK-NEWSAGG.ps1
- Stop         : .\scripts\STOP-NEWSAGG.ps1
- Publish kode : node ops\rebuild-live.mjs
- Scraper      : .\scripts\RUN-SCRAPER.ps1
- Log          : docker compose logs -f server client
- Setup Windows: .\scripts\SETUP-WINDOWS.ps1 (wajib PowerShell Administrator, lalu restart)
- URL publik   : .\scripts\SHOW-PUBLIC-URL.ps1
