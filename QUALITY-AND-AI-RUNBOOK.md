# NewsAgg — model AI, kebijakan kualitas, dan pemeriksaan

## Model dan layanan yang digunakan

| Fitur | Model / metode | Lokasi |
| --- | --- | --- |
| Sentimen multilingual | `cardiffnlp/twitter-xlm-roberta-base-sentiment` | Container scraper |
| Sentimen berita bisnis berbahasa Inggris | `ProsusAI/finbert` | Container scraper |
| Klasifikasi topik | `MoritzLaurer/mDeBERTa-v3-base-mnli-xnli`, FP32 | Container scraper |
| Pemeriksaan topik yang ambigu | Groq `openai/gpt-oss-120b`, maksimum 96 panggilan per run dan 12 per topik | API Groq |
| Nama orang, organisasi, lokasi | `Davlan/xlm-roberta-base-ner-hrl` | Container scraper |
| Toksisitas teks Inggris | `unitary/toxic-bert` | Container scraper |
| Embedding untuk pencarian semantik dan ringkasan | `BAAI/bge-m3`, 1.024 dimensi | Container `local-ai` (CPU, tanpa port publik) |
| Ringkasan | Kalimat dari artikel itu sendiri, BGE-M3 + MMR (`extractive-bge-m3-mmr-v4`); TF-IDF + MMR bila embedding tidak tersedia | Container scraper |
| Keyword Mandarin | Jieba TF-IDF | Container scraper |
| Chat artikel | Groq `openai/gpt-oss-120b`, cadangan `openai/gpt-oss-20b` | API Groq, wajib login |
| Terjemahan | Gemini `gemini-3.5-flash-lite`, cadangan Lingva untuk teks sampai 1.200 karakter | API |

Model Hugging Face diunduh ke volume `hf_cache` dan dijalankan di laptop. Kunci
API (Groq, Gemini) disimpan di `server/.env`. Jangan menaruh secret di variabel
`VITE_*`. Model mDeBERTa harus berjalan FP32 karena
[pembuat model menyatakan FP16 tidak didukung](https://huggingface.co/MoritzLaurer/mDeBERTa-v3-base-mnli-xnli);
tes regresi memeriksa pengaturan ini.

## Kebijakan kualitas berita

- Feed dan statistik publik memakai artikel 30 hari terakhir (`PUBLIC_WINDOW_DAYS`
  di `server/src/lib/articleQuality.ts`), sama dengan masa simpan `cleanup.py`.
- Edisi pagi hanya memakai artikel dengan tanggal terbit penerbit dalam 48 jam
  sebelum batas 05:40. Tanggal scrape tidak pernah dipakai sebagai tanggal terbit.
- Body artikel divalidasi dengan kebijakan `primary-story-v4`: rekomendasi dan
  artikel lain di halaman yang sama dibuang; artikel yang tercampur ditolak
  (`contaminated_body`).
- Target scraper adalah 20 artikel per pasangan sumber/topik, 30 pasangan.
  Kekurangan dicatat sebagai `deficit_*` dan status `partial`; kuota tidak
  diisi dengan artikel lama atau dari sumber lain.
- Skor topik dan sentimen adalah keluaran model, bukan penilaian kebenaran berita
  atau kredibilitas penerbit.

## Perintah pemeriksaan

```powershell
# Tes unit/regresi, build, dan pemeriksaan API. Tidak mengirim email.
.\scripts\VERIFY-NEWSAGG.ps1
# Ditambah panggilan kecil ke Groq/Gemini memakai kunci yang ada:
.\scripts\VERIFY-NEWSAGG.ps1 -LiveAI
# Pemeriksaan cepat API yang sedang berjalan (lokal atau publik):
.\scripts\VERIFY-API.ps1
.\scripts\VERIFY-API.ps1 -BaseUrl https://newsagg.sentsis.workers.dev
# Pemeriksaan harian tanpa scrape dan tanpa email:
.\scripts\RUN-NEWSAGG-DAILY.ps1 -DryRun
# Pratinjau cleanup (tidak menghapus apa pun tanpa --commit):
docker compose --profile scraper run --rm scraper python cleanup.py --days 30
```

`/api/stats/scraper-status` menampilkan run terakhir beserta defisit tiap
sumber/topik. Jangan menjalankan `cleanup.py --commit` untuk mencoba-coba; cleanup
resmi dijalankan task **NewsAgg Weekly Maintenance** setelah backup.
