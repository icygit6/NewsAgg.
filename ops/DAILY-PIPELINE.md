# NewsAgg daily pipeline — Asia/Taipei

> Historical runbook. As of 22 September evening, the active design is documented
> in `LIVE-PUBLICATION.md`: live staging/publication at 17:00, edition preparation at
> 05:40, delivery at 05:50 after ingestion completes. The old timings and single-run email contract below
> are retained as historical context, not current operating instructions.

## Active operating contract

One Windows task, `NewsAgg Daily Pipeline`, runs `server/scripts/daily-run.mjs`.
Configuration: `ops/daily-config.json`. Secrets stay in ignored `server/.env` and
the stable public origin stays in ignored root `.env`.

| Time | Operation |
| --- | --- |
| 00:05 | Start Docker if needed; run the prebuilt scraper, target 10 per supported source/category pair |
| 04:25 | Hard scraper deadline; stop that exact container if unfinished |
| 04:40 | Validate the completed run, check/recover the public URL, submit mail |
| 04:55 | Preferred delivery deadline / end of in-process SMTP retry window |
| Before 05:00 | Inbox target, not a provider delivery guarantee |

Recipients: 01257166, 01257168, 01257169 at `email.ntou.edu.tw`.
Keep this computer powered, connected, and signed into Windows. Locking is fine;
signing out/shutting down is not. WakeToRun cannot boot a powered-off computer.
Free Quick Tunnels have no availability guarantee. Recovery is performed before
daily delivery, not continuously throughout the day. No new paid service or key
was introduced. Local models execute in Docker on this computer.

## Data and safety gates

- The scraper writes a unique run key, DB run ID, timestamps, exact article IDs,
  counts and deficits to an atomic manifest. Errors / interruption exit nonzero.
- Publication window is 48 hours, with fresher candidates preferred. No old
  article is made fresh by substituting its scrape/update time.
- Only that completed run's IDs can enter its digest. Missing/unstructured/
  ineligible rows fail validation. Articles that age out while waiting are
  explicitly excluded; nothing is borrowed from another run.
- At least 8 fresh articles across 2 sources are required. Quota shortages and
  missing categories are visible as PARTIAL. These are minimum safety gates,
  not a claim that every category/source met its target.
- The email's sample includes up to 12 stories, balanced across available
  categories and sources, then displayed newest first.
- FAILED is a failure alert, never a stale successful digest. If a scraper
  process was interrupted, its exact container is stopped before an alert.
- Each recipient has a persisted delivery intent before SMTP DATA and a result
  afterwards. Accepted mail is not resent. Uncertain / interrupted DATA needs
  operator reconciliation, not blind retry. SMTP acceptance is not Inbox proof.
- The old Windows 05:00 task is disabled. Legacy local daily/scraper entrypoints
  reject competing GitHub calls while `logs/daily/primary-enabled.json` exists.
- GitHub workflow files are now manual-only locally. They have NOT been pushed;
  remote schedule configuration remains unverified. The old GitHub runner was
  offline at audit. Do not start it against old remote workflows before syncing
  and reviewing them, particularly their former destructive cleanup schedule.
- No database cleanup, backup, or deletion was performed by this change.

## Verification / operation

```powershell
# Read-only preflight: Docker + DB + SMTP authentication + public health. No email.
.\RUN-NEWSAGG-DAILY.ps1 -DryRun

# Unit, regression, build, and API checks. No email.
.\VERIFY-NEWSAGG.ps1

# Install/update the single primary Windows schedule.
.\INSTALL-DAILY-SCHEDULE.ps1

# Live ingestion benchmark ONLY outside the daily job; writes articles, no email.
# Do not run near midnight: the same process lock protects both modes.
.\RUN-NEWSAGG-DAILY.ps1 -Benchmark

# Full rerun of all sources, including rechecking stored recent stories.
# Writes validated articles; separate run manifest; NEVER sends duplicate mail.
.\RUN-NEWSAGG-DAILY.ps1 -Full

# Generate the redesigned HTML preview from a historical daily run, no SMTP.
node server/scripts/preview-daily-email.mjs 2026-09-22
```

Per-day records: `logs/daily/YYYY-MM-DD/{state,scraper,delivery,preview}.json`
and `pipeline.log`. These files are ignored by Git. Do not delete delivery state
to force a retry; that defeats deduplication. A crash leaves the lock's PID;
automatic recovery checks that its owner is no longer alive before takeover.
The task retries a failed host process at 10-minute intervals, up to 3 times.
Any catch-up delivery after 04:55 is logged as late, not counted as on-time.

## Acceptance still to prove

1. First real target-10 run completes within budget with useful category coverage.
2. All three campus recipients confirm Inbox arrival and timestamp before 05:00.
3. Two consecutive overnight runs, including duration, coverage and delivery log.
4. Remote GitHub schedules are actually removed after approved sync/deployment.

Passing tests and SMTP preflight alone do not establish these outcomes.

## First overnight result and follow-up (22 September)

- The 00:05 run finished all configured source/category stages at 01:07:35:
  79 stories, 76 inserted, 3 updated, zero DB/run errors. 78 remained within the
  freshness window at 04:40. Science was missing; source/category quotas were
  incomplete. PARTIAL describes coverage, not an interrupted scraper.
- SMTP accepted all three messages at 04:40:09–04:40:16 Taipei. The user confirmed
  receiving a partial email, but individual Inbox timestamps for all recipients
  are not established by SMTP acceptance alone.
- Discovery now tries section pages whenever accepted feed stories do not fill
  the quota. Previously, a large raw RSS feed could suppress that fallback even
  if its stories were stale or mismatched. Candidate exploration remains bounded.
- The hosted category second-opinion budget is now reserved across categories
  (12 requests/category, 96 maximum/run). Repeated successful classifications are
  cached; confident competing local labels do not consume hosted calls. Provider
  outages/quotas still fail closed; unverified is counted separately from mismatch.
- BBC Science discovery also checks the technology RSS feed. No freshness or
  category threshold was relaxed to inflate coverage.
- Email now has responsive table-based article cards, concise coverage, explicit
  status, and escaped links/content. No raw quota JSON is dumped into the email.
- Full rerun started at 07:14 Taipei in a separate no-email run. Final coverage
  and duration remain pending. The original delivery ledger is preserved.
