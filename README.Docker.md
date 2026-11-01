# NewsAgg: Automated News Aggregation, NLP-Based Sentiment and Topic Classification, and Topic Insights Dashboard

NewsAgg：自動化新聞聚合、以 NLP 進行情緒與主題分類，以及主題洞察儀表板

## Docker Guide

`docker-compose.yml` menjalankan service berikut:

| Service    | Isi                                                        | Port host (hanya 127.0.0.1) |
|------------|------------------------------------------------------------|-----------------------------|
| `db`       | PostgreSQL 18 + pgvector, data di volume `pgdata`          | `5433`                      |
| `dbviewer` | pgweb read-only, dibuka lewat `/dbviewer/` (login admin)   | `8081`                      |
| `server`   | API Express + TypeScript                                   | `3000`                      |
| `client`   | Frontend Vite di-serve Nginx, juga proxy `/api` ke server  | `8080`                      |
| `local-ai` | Embedding BGE-M3 untuk pencarian semantik (CPU)            | — (internal, port 8090)     |
| `tunnel`   | Cloudflare Quick Tunnel ke `client`                        | —                           |
| `scraper`  | Pipeline Python (profile `scraper`, jalan on-demand)       | —                           |

**Jangan pernah menjalankan
`docker compose down -v`**: perintah itu menghapus volume `pgdata` beserta semua data.

## Environment

- **`.env`** (root, dari `compose.env.example`): `NEWSAGG_DB_PASSWORD`,
  `NEWSAGG_DBVIEWER_PASSWORD`, `NEWSAGG_STABLE_URL`, serta ID publik `VITE_*`.
- **`server/.env`** (dari `server.env.example`): `SECRET_KEY` (wajib), API key
  opsional (Groq, Gemini, Google, Turnstile, SMTP), dan `NEONDB_URL` ke
  `127.0.0.1:5433` untuk skrip di host. Di dalam container, URL database diganti
  otomatis ke service `db`.
- **`server/.hf.env`** (opsional, diabaikan Git): `HF_TOKEN=...` untuk unduhan model.

Frontend memakai origin yang sama (`VITE_API_URL` kosong); Nginx meneruskan API ke
server. Jangan menaruh secret di variabel `VITE_*`.

## Build & jalankan (dari root proyek)

Cara biasa di Windows adalah `.\scripts\START-NEWSAGG.ps1` (lihat START-RESTART-GUIDE.txt).
Secara manual:

```bash
docker compose up -d --build
```

| Service      | URL                                  |
|--------------|--------------------------------------|
| Client (app) | http://localhost:8080                |
| Server API   | http://localhost:3000                |
| Health check | http://localhost:3000/health?db=1    |
| Situs publik | https://newsagg.sentsis.workers.dev  |

Untuk menerbitkan perubahan kode ke situs live, jalankan `node ops\rebuild-live.mjs`;
skrip ini hanya membangun ulang bagian yang berubah dan tidak menyentuh volume database.

Stop: `.\scripts\STOP-NEWSAGG.ps1` atau `docker compose down` (tanpa `-v`).

## Scraper (profile terpisah)

```bash
docker compose --profile scraper run --rm scraper
```

Jadwal harian menjalankan scraper otomatis pukul 17:00 lewat `server/scripts/daily-run.mjs`.
Model Hugging Face di-cache di volume `hf_cache` agar tidak diunduh ulang tiap run.

## Masalah umum

- **"Cannot connect to Docker daemon"** — pastikan Docker Desktop berjalan.
- **Server tidak sehat / API error** — cek `docker compose logs server db` dan
  `http://localhost:3000/health?db=1`.
- **Server exit saat boot** — `SECRET_KEY` belum diisi (`NODE_ENV=production` mewajibkannya).
- **Compose menolak start** — `NEWSAGG_DB_PASSWORD` belum diisi di `.env` root.
- **Perubahan kode tidak muncul** — jalankan `node ops\rebuild-live.mjs` (atau `docker compose up -d --build`).
- **Situs publik mati tapi lokal jalan** — jalankan `.\scripts\UPDATE-STABLE-ORIGIN.ps1`, lalu `.\scripts\SHOW-PUBLIC-URL.ps1`.
