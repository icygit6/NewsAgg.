# NewsAgg: Automated News Aggregation, NLP-Based Sentiment and Topic Classification, and Topic Insights Dashboard

NewsAgg：自動化新聞聚合、以 NLP 進行情緒與主題分類，以及主題洞察儀表板

## Scraper

Transformer-enriched news scraper, organised as a modular `core/` + `sources/`
package.

## Layout

```
scraper/
├── core/
│   ├── config.py       env loading, constants, category labels, thresholds
│   ├── cleaner.py      domain/URL helpers, article-URL patterns, freshness, source names
│   ├── http.py         rate-limited session, crawling, Playwright render
│   ├── extract.py      OG / JSON-LD / video / related / author extraction
│   ├── quality.py      deterministic article validation (body policy primary-story-v4)
│   ├── nlp.py          HF models: sentiment, NER, toxicity, zero-shot, readability
│   ├── routing.py      pre-routing of mixed feeds into the eight topics
│   ├── taxonomy.py     topic taxonomy shared by local and hosted classification
│   ├── category.py     bounded hosted second opinion for ambiguous topics (96/run)
│   ├── semantic.py     client for the local BGE-M3 embedding service
│   ├── summarizer.py   extractive summaries from the article's own sentences
│   ├── translator.py   Gemini → Lingva translation (Yahoo Taiwan → English index)
│   ├── publication.py  fail-closed admission check just before publishing
│   ├── deadline.py     cooperative stop time (--stop-at) for scheduled runs
│   ├── db.py           PostgreSQL upsert (live schema) + canonical dedup
│   └── pipeline.py     enrich_article + run_source orchestration
├── sources/
│   ├── scraper_cnn.py        English
│   ├── scraper_bbc.py        English
│   ├── scraper_aljazeera.py  English
│   └── scraper_yahoo_tw.py   zh-TW (Yahoo Taiwan), Playwright, section→topic mapping
├── run_all.py         every source/topic pair in quota rounds (used by the daily run)
├── run_single.py      python run_single.py --source cnn
├── local_ai.py        internal CPU embedding service (the compose `local-ai` container)
├── cleanup.py         delete articles >30 days AND not protected/bookmarked
└── requirements.txt
```

## Setup

```bash
pip install -r requirements.txt
playwright install chromium        # only needed for Yahoo Taiwan
```

Credentials are read (in order of precedence) from the real environment, then
`scraper/.env`, then `server/.env`:

```env
NEONDB_URL=postgresql://...      # local db: 127.0.0.1:5433; also accepts DATABASE_URL / NEON_DSN
HF_TOKEN=                         # optional — models are public
GEMINI_API_KEY=                   # optional — translator falls back to Lingva
```

## Usage

```bash
python run_single.py --source cnn            # one source → live DB
python run_single.py -s yahoo_tw --no-db     # enrich only, no DB write
python run_single.py -s bbc --target 25 --json bbc.json
python run_all.py                            # all sources → live DB
python cleanup.py                            # dry run
python cleanup.py --commit                   # actually delete stale rows
```

## Notes

- **Live DB schema is authoritative.** `core/db.py` writes the existing
  shape (text `id`/`source_id`, `authors` table, `sentiment_polarity`
  + `sentiment_pos/neu/neg`, `ai_relevance`, JSONB `keywords/entities/images`);
  see `server/src/db/migrations/000_init_live_schema.sql`. Do **not** swap it
  for a UUID / `sentiment_prob_*` schema.
- In Docker the scraper runs as `docker compose --profile scraper run --rm scraper`;
  the scheduled 17:00 run starts it through `server/scripts/daily-run.mjs` with a
  `--stop-at` time ten minutes before the 210-minute deadline.
- Models load lazily and use the GPU automatically when `torch.cuda` is
  available, otherwise CPU.
- Dedup: articles already present (by `canonical_url`) are skipped before
  enrichment; `insert_article` also upserts via `ON CONFLICT (canonical_url)`.
