# NewsAgg: Automated Multilingual News Aggregation with NLP Sentiment Analysis and Topic Insights Dashboard

NewsAgg：自動化多語新聞聚合，結合 NLP 情感分析與主題洞察儀表板

## Free-only deployment

This deployment intentionally avoids a custom domain, a paid Cloudflare plan,
a hosted database, and GitHub-hosted runners. The laptop, Docker Desktop, and
the signed-in Windows session must stay online for the public site and the
scheduled jobs.

## Public access

Visitors use the fixed address **https://newsagg.sentsis.workers.dev**. It is a
free Cloudflare Worker (`deploy/stable-origin`) that forwards to a free Quick
Tunnel started by `scripts\START-NEWSAGG.ps1`; no tunnel token, DNS record, or purchased
domain is needed.

```powershell
.\scripts\START-NEWSAGG.ps1
.\scripts\SHOW-PUBLIC-URL.ps1
```

The temporary `https://*.trycloudflare.com` upstream changes whenever the tunnel
container is recreated. `scripts\UPDATE-STABLE-ORIGIN.ps1` points the Worker at the new
upstream, and the **NewsAgg Web Recovery** task does this automatically every two
minutes while you are signed in (`ops/WEB-RECOVERY.md`). Quick Tunnel has no
uptime guarantee and limits concurrent in-flight requests.

## Scheduled jobs (Windows Task Scheduler, Asia/Taipei)

- 17:00 `NewsAgg Live Ingestion`: scrape, validate and publish news, within a
  210-minute budget.
- 05:40 `NewsAgg Daily Pipeline`: freeze the morning edition; email at 05:50,
  retries until 06:05.
- Sunday 21:30 `NewsAgg Weekly Maintenance`: `pg_dump` backup, then remove
  articles older than 30 days.
- Every 2 minutes `NewsAgg Web Recovery`: reconnect the tunnel and Worker.

Install them with `scripts\INSTALL-DAILY-SCHEDULE.ps1`, `scripts\INSTALL-DB-MAINTENANCE.ps1` and
`scripts\INSTALL-WEB-RECOVERY.ps1`. The GitHub workflows are manual-only and run on the
self-hosted runner, so they never use metered GitHub-hosted minutes. Details:
`ops/LIVE-PUBLICATION.md`.

## Database

PostgreSQL 18 with pgvector runs in the compose `db` service, with its data in
the `pgdata` volume. Never run
`docker compose down -v`, which deletes that volume. Backups are written to
`backups\`; see START-RESTART-GUIDE.txt for keeping a second copy elsewhere.

## Required local configuration

Copy the example files if they do not exist, then keep the completed files out
of Git:

```powershell
Copy-Item compose.env.example .env
Copy-Item server.env.example server/.env
.\scripts\CONFIGURE-PRODUCTION.ps1
```

The root `.env` must set `NEWSAGG_DB_PASSWORD` (and `NEWSAGG_DBVIEWER_PASSWORD`
for the read-only viewer) and `NEWSAGG_STABLE_URL`. `server/.env` must contain an
application secret (`SECRET_KEY`) and, for the host-side daily and backup scripts,
`NEONDB_URL=postgres://newsagg:<password>@127.0.0.1:5433/newsagg`. The containers
get their own database URL from `docker-compose.yml`.

## Optional integrations

These integrations are optional and the application starts without them:

- `GEMINI_API_KEY`: translation uses Gemini when configured and otherwise tries
  the no-key Lingva fallback.
- `GROQ_API_KEY`: enables article chat. Without it, AI chat is unavailable.
- `GOOGLE_CLIENT_ID`: enables Google Sign-In. Register the fixed workers.dev
  address once as an authorized JavaScript origin; tunnel rotation does not
  change it.
- `TURNSTILE_SECRET` and `VITE_TURNSTILE_SITE_KEY`: optional free CAPTCHA.
- `SENTRY_DSN`, `FAVQS_API_KEY`, and `TWELVE_DATA_API_KEY`:
  optional. Leave them empty to avoid external plans or quotas. Finance falls
  back to no-key public data sources when Twelve Data is empty.
- `HF_TOKEN`: optional for downloading Hugging Face models; local cached models
  continue to work without a paid inference service.

Free tiers still have provider quotas. Do not upgrade a provider account or add
a payment method unless you deliberately choose to do so.

## Gmail delivery

Email uses Gmail SMTP with a Google App Password; it is not a paid email API.
Set `SMTP_USER` and `SMTP_PASS` in `server/.env`. The daily recipients are in
`ops/daily-config.json`; extra recipients saved through the manual GitHub
workflow are added from `REPORT_EMAIL_TO`.

## Validate

```powershell
docker compose config --quiet
.\scripts\CHECK-NEWSAGG.ps1
Invoke-RestMethod "http://127.0.0.1:3000/health?db=1"
Invoke-RestMethod http://127.0.0.1:3000/api/markets/summary
```
