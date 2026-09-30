# NewsAgg: Automated News Aggregation, NLP-Based Sentiment and Topic Classification, and Topic Insights Dashboard

NewsAgg：自動化新聞聚合、以 NLP 進行情緒與主題分類，以及主題洞察儀表板

## GitHub Actions operations / GitHub Actions 操作

GitHub Actions is the intended owner of both daily jobs. The Windows self-hosted runner on this laptop executes them using `D:\Website` and Docker Desktop; these are not GitHub-hosted jobs. The machine, runner, Docker Desktop, and internet connection must remain available. The public origin remains `https://newsagg.sentsis.workers.dev/`.

| Taipei time | Workflow | Action |
| --- | --- | --- |
| 17:05 | `Scraper` | `RUN-NEWSAGG-DAILY.ps1 -Ingest` publishes verified news for the next edition. |
| 04:25 | `NewsAgg Daily Publish and Report` | Freezes the 04:30 edition and sends at 04:40. |

The cron expressions are UTC (`09:05` and `20:25`) because Taiwan stays at UTC+8. GitHub may delay scheduled events, so the daily pipeline's own state, locks, and delivery ledger remain the final authority. Both workflows share a concurrency group to prevent overlapping runs. Do not re-enable the Windows ingestion/delivery tasks while these schedules are active or they may race for the same edition.

Both workflows need the local ignored `.env` and `server/.env` configuration (database, public URL, SMTP). The configured recipients are in `ops/daily-config.json`: the three NTOU addresses plus `edkong17@gmail.com` and `xuemingwang28@gmail.com`. GitHub's `SMTP_PASS` secret can still be supplied, but the local `server/.env` takes priority for this self-hosted runner. Never commit passwords or tokens.

### Manual tests / 手動測試

In **Actions → Scraper → Run workflow**, choose `scrape` to invoke real daily ingestion. If the edition is already complete, it exits successfully with `ingestion_already_complete`; choose `full-recheck` only when you intentionally want a fresh, potentially long recheck without sending email. `cleanup` is a preview, and `backfill-lang` is a separate database maintenance action.

In **Actions → NewsAgg Daily Publish and Report → Run workflow**, `preflight` checks dependencies without sending email. Choose `send` only if you intend to run the real daily edition; the delivery ledger prevents resending already accepted recipients. The old `GITHUB-DAILY-PUBLISH.ps1` workflow is obsolete and must not be used.

GitHub Actions 的兩個排程都透過本機 Windows 自架執行器執行；請保持電腦、Docker 與網路運作。手動測試 Scraper 時，`scrape` 會使用每日執行紀錄；若當日已完成，會安全結束而不重複擷取。`full-recheck` 才會重新檢查，但不寄送每日郵件。
