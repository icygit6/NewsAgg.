# NewsAgg: live publication + prepared morning edition

## Architecture

Public origin: **https://newsagg.sentsis.workers.dev**. Root `NEWSAGG_STABLE_URL`
holds this address; daily jobs, email links, server CORS and public-origin
settings read it from there. Google OAuth uses it as its Authorized JavaScript
origin. Tunnel rotation behind the Worker does not change this address.

One PostgreSQL 18 + pgvector database (the compose `db` service), two schemas:

- `staging.articles`: candidate → pending → ready → published / rejected.
  Candidates are stored before enrichment; enriched payloads are persisted before
  publication. Failed work never replaces live news.
- `public.articles`: approved articles. IDs are kept on canonical conflicts so
  bookmarks, posts and links keep working.
- `public.article_publications`: approval time, content hash, run key. The article
  and receipt commit together. Published staging bodies become compact receipts
  in that transaction, so full bodies are not stored twice.
- `public.publication_state`: revision changes on public article writes. Feed,
  reader and analytics caches verify it on each request. Browser responses are
  no-store, so a refresh shows newly committed articles.
- `public.newsletter_editions`: one immutable message per Taipei date, including
  selected IDs, coverage, cutoff, full HTML and plain text. Later scraping,
  template changes and retries cannot alter the saved email.

Public API routes never read staging. The staging schema has no PUBLIC grants;
the application database owner keeps administrative access.

Classification: local NLI labels use short reporting concepts, with a shared
detailed taxonomy for the hosted second opinion. It samples the opening, middle
and end of the article; near ties and science/gaming overlap require
confirmation. Hosted calls are capped at 96 per run and 12 per topic, with
reserved publisher shares and explicit budget/provider rejection reasons.
Every source/topic pair first gets up to 2 accepted articles from 12 attempts;
later rounds add up to 5 at a time without re-extracting rejected candidates.
Summary input excludes captions and headings. Gallery extraction excludes later
Yahoo stories and recommendations. The publication check compares reader blocks
with the plain body text and rejects stale hero image URLs.

A running scraper container keeps the code it started with; a rebuilt scraper
image applies to the next run.

## Schedule — Asia/Taipei

| Time | Action |
| --- | --- |
| 17:00 | `NewsAgg Live Ingestion`: scrape, stage, validate, immediately publish each ready article |
| Up to 210 minutes | Target 20 per source/topic pair, 30 pairs (600); recent stored stories rechecked; storage guard |
| 05:40 next morning | `NewsAgg Daily Pipeline`: require completed ingestion, then prepare the edition from approved published articles |
| 05:50 | Check/recover public URL and submit the saved email |
| 06:05 | SMTP retry deadline; later sends are logged as late |

An evening run belongs to the following morning. Eligibility requires approval
between yesterday 17:00 and today's 05:40, a matching content hash, a structured
body, a summary, and a publisher publication time within 48 hours of the cutoff.
Publisher dates are never replaced with scrape timestamps.

The email selects up to 12 topic/source-balanced stories. Minimum: 8 eligible
articles from 2 sources. Coverage is PARTIAL until every source/topic target is
met. An empty or invalid edition is sent as a failure notice. Email requires the
matching ingestion run to have finished before 05:40; a missing, running, failed
or unvalidated run holds delivery and Windows retries the task. The preparation
step shares the ingestion lock, so later publication cannot alter the edition.

Recipients: the five addresses in `ops/daily-config.json` (three NTOU campus
addresses and two others), plus any extra recipients saved in `REPORT_EMAIL_TO`.
SMTP acceptance at 05:50 is not proof of Inbox arrival at that time.

## Safety and limits

- Scheduled ingestion passes an absolute `--stop-at` time to the scraper, 10
  minutes before the 210-minute deadline. At that time the current article is
  finished, its ID is checkpointed, and the scraper writes a `partial` report with
  the quota deficits and `stopReason: time_budget`. Real errors, forced
  termination, and insufficient validated coverage still block email.
- Delivery intent is saved before SMTP DATA. Accepted sends are never repeated;
  uncertain or interrupted sends need operator reconciliation. Never delete the
  delivery ledger to force a resend.
- A crash can leave pending/ready staging rows; the public version stays intact.
  A publication write retries once; the next ingestion rechecks failed work.
  A failed evening process gets at most three attempts, each with a new run
  identity, all sharing the original 210-minute deadline. The previous container
  is stopped before a retry. Windows retries ingestion twice and the morning job
  three times, at five-minute intervals.
- Windows must stay signed in, powered, connected, with Docker running. Locking
  the screen is fine; signing out or shutting down stops the scheduled tasks.
- Tunnel recovery runs at ingestion start, before the morning email, and every
  two minutes through **NewsAgg Web Recovery** (`WEB-RECOVERY.md`).
- The GitHub workflows are manual-only (`workflow_dispatch`). Their cleanup option
  only previews. Database cleanup runs only in **NewsAgg Weekly Maintenance**
  (Sunday 21:30), after a backup.

## Commands

```powershell
# No scraping, mail, tunnel rotation or schedule change:
.\scripts\RUN-NEWSAGG-DAILY.ps1 -DryRun
.\scripts\VERIFY-NEWSAGG.ps1

# Install both daily Windows tasks:
.\scripts\INSTALL-DAILY-SCHEDULE.ps1

# Evening ingestion only, no email:
.\scripts\RUN-NEWSAGG-DAILY.ps1 -Ingest

# Separate full recheck outside the scheduled run, no email:
.\scripts\RUN-NEWSAGG-DAILY.ps1 -Full

# From the server folder: read-only status and rollback-only edition check:
node scripts/publication-status.mjs
node scripts/verify-edition-live.mjs

# From the project root: rollback-only publication integration test:
docker compose --profile scraper run --rm scraper python test_publication_live.py

# Local-model smoke check on 10 examples (not an accuracy estimate):
docker compose --profile scraper run --rm scraper python evaluate_taxonomy.py

# Preview a correction for one article (no writes without --apply):
docker compose --profile scraper run --rm scraper python repair_recent.py --id ARTICLE_ID --topic Lifestyle
```

Config: `ops/daily-config.json`. Secrets stay in the gitignored env files.
Ingestion reports: `logs/daily/ingestion-YYYY-MM-DD` (named by morning edition
date). Delivery logs and ledger: `logs/daily/YYYY-MM-DD`. The database message is
authoritative; `preview.json` is a copy, not permission to resend.
