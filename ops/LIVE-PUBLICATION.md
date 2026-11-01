# NewsAgg: live publication + prepared morning edition

## Architecture

Public origin: **https://newsagg.sentsis.workers.dev** (account subdomain renamed
by the owner on 22 September). Root `NEWSAGG_STABLE_URL` is the source for newly
started daily jobs, email links, server CORS and public-origin settings. Existing
prepared editions/delivered emails are never rewritten during a hostname change.
Google OAuth needs this exact Authorized JavaScript origin; users sign in once
on the new hostname. Internal tunnel rotation does not change this public URL.

One Neon database, two schemas. No database replacement, backup, article deletion,
paid service, or additional external API key was required.

- `staging.articles`: candidate → pending → ready → published / rejected.
  Candidates are stored before enrichment; enriched payloads are persisted before
  publication. Failed work never replaces live news.
- `public.articles`: approved articles. Existing historical rows remain available;
  IDs are retained on canonical conflicts to preserve bookmarks, posts and links.
- `public.article_publications`: approval time, content hash, run key. The article
  and receipt commit together. Published staging bodies become compact receipts
  in that transaction, avoiding duplicate storage of full bodies.
- `public.publication_state`: revision changes on public article writes. Feed,
  reader and analytics caches verify it on each request. Browser responses are
  no-store: refresh sees newly committed articles instead of a 5-minute-old feed.
- `public.newsletter_editions`: one immutable message per Taipei date, including
  selected IDs, coverage, cutoff, full HTML and plain text. Later scraping,
  template changes and retries cannot silently alter the saved email.

Scraper quality revision (22 September evening): local NLI labels use short
reporting concepts, with a shared detailed taxonomy for hosted second opinions.
Classification samples the opening/middle/end; near ties and science/gaming
overlap require confirmation. Hosted calls remain capped at 96/run and 12/topic,
now with reserved publisher shares and explicit budget/provider rejection reasons.
All source/category pairs get a first pass (up to 2 accepted / 12 attempted), then
remaining quotas are filled without re-extracting the same rejected candidate.
Ordering uses the configured freshness window, not the historical 30-day counts.
Summary input excludes captions/headings. Gallery extraction excludes subsequent
Yahoo stories and recommendations. Publication checks reader blocks against plain
body text and rejects stale hero URLs in an unavailable-image fallback.

Rebuilding the scraper image does not hot-swap an already running container.
These rules apply to newly started containers; an in-flight run keeps its original
code. The controlled single-article repair command can apply fixes independently.

Public API routes never read staging. The staging schema has no PUBLIC grants;
the existing application DB owner retains administrative access. This is schema/
application isolation, not a newly provisioned least-privilege database role.

## Schedule — Asia/Taipei

| Time | Action |
| --- | --- |
| 17:00 | `NewsAgg Live Ingestion`: scrape, stage, validate, immediately publish each ready article |
| Up to 210 minutes | Bounded run, target 20 per supported source/category; recent stored stories rechecked; storage headroom guard |
| 05:40 next morning | `NewsAgg Daily Pipeline`: require completed ingestion, then prepare the edition from approved published articles |
| 05:50 | Check/recover public URL and submit the saved email |
| 06:05 | Preferred SMTP deadline; late recovery is logged |

An evening run belongs to the following morning. Eligibility requires approval
between yesterday 17:00 and today's 05:40, matching content hash, structured body,
summary, and publisher publication time within 48 hours of cutoff. Publisher dates
are never replaced with scrape timestamps. A rechecked story may have originally
been published before the evening, within that allowed window.

The email selects up to 12 category/source-balanced stories. Minimum: 8 eligible
articles and 2 sources. Coverage stays PARTIAL until configured source/category
targets are actually met. Empty/invalid editions are failure notices, not stale
digests. Email requires the matching ingestion run to have finished successfully before
05:40. Missing, running, failed, or unvalidated ingestion holds delivery; Windows
retries the task. Quota deficits alone do not mean the scraper is still running.
The preparation step shares the ingestion lock; later publication cannot alter
the saved edition.

Recipients: 01257166, 01257168, 01257169 at `email.ntou.edu.tw`.
SMTP acceptance at 05:50 does not guarantee the provider
will deliver to the Inbox at exactly that time.

## Safety and limits

- Scheduled ingestion passes an absolute `--stop-at` time to the scraper. For
  the normal 210-minute host budget, new discovery/enrichment stops 10 minutes
  before the unchanged hard deadline. The current article is finished and its
  accepted ID checkpointed; the worker then saves an honest `partial` report
  with quota deficits and `stopReason: time_budget`. Real errors, forced
  termination, and missing/insufficient validated coverage still block email.
  Short benchmark/retry windows reserve 10% (at least 5 seconds) instead of
  extending the original deadline. The original failed 24 October edition is
  preserved; this change does not retry or send that edition automatically.
- Delivery intent is saved before SMTP DATA. Accepted sends are never repeated;
  uncertain/interrupted sends need operator reconciliation. Never delete the
  delivery ledger to force a resend. A revision requires explicit approval and
  its own identity, not an edit to an immutable edition.
- Crashes can leave pending/ready staging rows; the public version stays intact.
  A current publication write retries once; later ingestion rechecks failed work.
  An interrupted/failed evening process gets at most three attempts, with a new
  run identity and an archived prior manifest. All attempts share the original
  210-minute deadline; restarting cannot extend it. The exact previous container
  is stopped before a retry, and canonical upserts preserve public article IDs.
  Windows retries failure twice at five-minute intervals. There is no unbounded
  recovery loop or silent admission of unverified content.
- Windows must remain signed in, powered, connected, with Docker available.
  Locking is fine; signing out or shutdown prevents Interactive scheduled tasks.
- Free Quick Tunnels can expire. Recovery runs at ingestion startup and before
  morning email; there is no continuous uptime guarantee.
- Local GitHub workflows are manual-only; remote edits have NOT been pushed or
  verified. Legacy local entrypoints block competing scheduled calls. Do not
  restart the old runner against unreviewed remote workflows, especially their
  former destructive cleanup. No cleanup deletion was performed.

## Commands

```powershell
# No scraping, mail, tunnel rotation or schedule mutation:
.\RUN-NEWSAGG-DAILY.ps1 -DryRun
.\VERIFY-NEWSAGG.ps1

# Install both coordinated Windows tasks:
.\INSTALL-DAILY-SCHEDULE.ps1

# Evening ingestion only, no email:
.\RUN-NEWSAGG-DAILY.ps1 -Ingest

# Separate full recheck, outside the scheduled run, no email:
.\RUN-NEWSAGG-DAILY.ps1 -Full

# From server folder: read-only status and rollback-only snapshot integration test:
node scripts/publication-status.mjs
node scripts/verify-edition-live.mjs

# From project root: rollback-only publication integration test:
docker compose --profile scraper run --rm scraper python test_publication_live.py

# Real local-model smoke check (10 examples, NOT a population accuracy estimate):
docker compose --profile scraper run --rm scraper python evaluate_taxonomy.py

# Preview a specifically identified correction (no writes without --apply):
docker compose --profile scraper run --rm scraper python repair_recent.py --id ARTICLE_ID --topic Lifestyle
```

Config: `ops/daily-config.json`. Secrets remain in ignored env files.
Ingestion reports: `logs/daily/ingestion-YYYY-MM-DD` (morning edition date).
Delivery logs/ledger: `logs/daily/YYYY-MM-DD`. The DB message is authoritative;
`preview.json` is a copy, not permission to resend.

## Acceptance

Rollback-only DB checks proved pending candidates are invisible to public reads,
approved articles and receipts are atomic, rejected updates preserve live content,
and frozen messages cannot be edited or rebuilt on retry. Fixtures were rolled
back; no fake article/edition was retained and no test email was sent.

First overnight cycle verified on 23 September 2026 (all times Asia/Taipei):

- Ingestion completed 22 September 21:54 with zero reported scraper/DB errors.
- The 23 September edition froze at 04:30:04 without a late-freeze flag, from
  116 approved articles across four sources and all eight categories.
- The email contains 12 selected article links, all on
  `https://newsagg.sentsis.workers.dev`; no old-hostname links were found.
- SMTP accepted 01257166 at 04:40:07, 01257168 at 04:40:10, and 01257169 at
  04:40:13, each on its first attempt. The delivery state is `delivered` and the
  Windows task exited successfully. No manual resend was performed.
- Editorial coverage remains PARTIAL: several source/category quotas are not
  met, especially Science. This is independent of delivery success. The prior
  evening's in-flight container used the older classifier/scheduling code; the
  next scheduled ingestion uses the rebuilt quality revision.
- Both daily tasks remain enabled. Next ingestion: 23 September 17:00; next
  edition job: 24 September 04:30, with mail planned for 04:40. Public health and
  SMTP verification passed again at 07:57, without sending another message.

Actual Inbox/Spam arrival times and a second successful night remain unverified.
Unit/integration tests and one successful delivery cycle do not establish an
uptime guarantee or measured classifier accuracy.
