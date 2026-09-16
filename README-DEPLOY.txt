NEWSAGG - WINDOWS + DOCKER + FREE QUICK TUNNEL
==============================================

ISI PAKET
- client, server, scraper: source yang dibutuhkan Docker
- docker-compose.yml: menjalankan client dan server
- START/STOP/CHECK-NEWSAGG.ps1: operasi harian
- RUN-SCRAPER.ps1: menjalankan scraper secara manual
- iis-site/web.config: reverse proxy IIS opsional; tidak diperlukan untuk Quick Tunnel
- *.env.example: template tanpa password atau API key

PERSYARATAN
1. Windows 10/11 64-bit dengan WSL2 dan Docker Desktop.
2. NEONDB_URL dan SECRET_KEY. API key AI boleh dikosongkan dahulu.
3. IIS tidak diperlukan untuk deployment Quick Tunnel berbasis Docker.

PERSIAPAN WINDOWS PERTAMA KALI
1. Klik kanan PowerShell > Run as Administrator.
2. Jalankan: Set-ExecutionPolicy -Scope Process Bypass
3. Jalankan: .\SETUP-WINDOWS.ps1
4. Restart Windows (skrip tidak melakukan restart otomatis).
5. Buka Docker Desktop dan tunggu sampai engine aktif.

MENJALANKAN DOCKER SAJA
1. Extract ZIP ke folder biasa, misalnya D:\NewsAgg.
2. Klik kanan START-NEWSAGG.ps1 > Run with PowerShell.
3. Pada run pertama, skrip membuat .env dan server/.env lalu berhenti.
4. Isi NEONDB_URL dan SECRET_KEY di server/.env.
5. Jalankan START-NEWSAGG.ps1 lagi.
6. Buka http://localhost:8080.
7. Tunnel publik ikut berjalan. Jalankan SHOW-PUBLIC-URL.ps1 untuk melihat URL HTTPS.

PUBLIK TANPA IIS (DIREKOMENDASIKAN UNTUK DEMO)
1. START-NEWSAGG.ps1 menjalankan client, server, dan Cloudflare Quick Tunnel bersama-sama.
2. Tunnel meneruskan trafik langsung ke Nginx dalam container client; IIS boleh dihentikan.
3. Jalankan SHOW-PUBLIC-URL.ps1 untuk melihat alamat trycloudflare.com terbaru.
4. Quick Tunnel adalah layanan demo; alamat dapat berubah setelah tunnel restart.

MEMASUKKAN UPDATE KODE
1. Jangan pernah replace file .env atau server/.env; file itu berisi konfigurasi/secret laptop server.
2. Replace hanya file source yang dikirim rekan, tetapi pertahankan struktur foldernya.
3. Jika ada package.json, package-lock.json, Dockerfile, docker-compose.yml, web.config,
   atau file migration baru, perlakukan sebagai update deployment dan periksa secara khusus.
4. Setelah replace, jalankan START-NEWSAGG.ps1. Docker akan rebuild bagian yang berubah.
5. Jalankan CHECK-NEWSAGG.ps1 dan uji login, bookmark, halaman artikel, serta health API.
6. Simpan salinan versi yang sedang berjalan sebelum replace agar mudah rollback.

CATATAN KEAMANAN
- Jangan kirim server/.env yang sudah terisi melalui Git atau grup chat.
- Kirim NEONDB_URL dan SECRET_KEY kepada admin laptop melalui kanal privat.
- Port 3000 dan 8080 sebaiknya dibatasi Windows Firewall untuk akses lokal bila IIS
  menjadi satu-satunya pintu publik.
- Folder .git, node_modules, venv, cache, log, dan file .env asli tidak ada di ZIP.
- Folder ini belum menjadi repository Git. Untuk update rutin, Git lebih aman daripada copy/replace
  manual karena perubahan dapat ditinjau dan dikembalikan jika deployment gagal.

PERINTAH PENTING
- Start/update : .\START-NEWSAGG.ps1
- Status       : .\CHECK-NEWSAGG.ps1
- Stop         : .\STOP-NEWSAGG.ps1
- Scraper      : .\RUN-SCRAPER.ps1
- Log          : docker compose logs -f server client
- Setup Windows: .\SETUP-WINDOWS.ps1 (wajib PowerShell Administrator, lalu restart)
- URL demo publik: .\SHOW-PUBLIC-URL.ps1
- Hentikan IIS   : .\DISABLE-IIS.ps1 (PowerShell Administrator; opsional)
