# NewsAgg: Automated Multilingual News Aggregation with NLP Sentiment Analysis and Topic Insights Dashboard

NewsAgg：自動化多語新聞聚合，結合 NLP 情感分析與主題洞察儀表板

## GitHub Actions operations / GitHub Actions 操作

Windows Task Scheduler owns both daily jobs. GitHub Actions remains the manual operation and recovery interface, using the Windows self-hosted runner on this laptop and `D:\Website`. The machine, Windows session, Docker Desktop, and internet connection must remain available. The public origin remains `https://newsagg.sentsis.workers.dev/`.

| Taipei time | Windows task | Action |
| --- | --- | --- |
| 17:00 | `NewsAgg Live Ingestion` | Publishes verified news for the next edition, with a bounded 210-minute budget. |
| 05:40 | `NewsAgg Daily Pipeline` | Freezes the morning edition and sends at 05:50 (retries until 06:05). |
| Sunday 21:30 | `NewsAgg Weekly Maintenance` | Backs up the database, then removes articles older than 30 days. |

Both Actions workflows are manual-only (`workflow_dispatch`); GitHub never starts them on a timer. Install the local schedules with `scripts\INSTALL-DAILY-SCHEDULE.ps1` and `scripts\INSTALL-DB-MAINTENANCE.ps1`. WakeToRun and StartWhenAvailable are enabled, but they cannot guarantee completion if the computer is powered off or the Windows user is signed out. The run state, lock, immutable edition, and delivery ledger still prevent overlapping ingestion and duplicate email. Retries keep the original deadline; never remove a state file to extend it.

Both workflows need the local ignored `.env` and `server/.env` configuration (database, public URL, SMTP). The configured recipients are in `ops/daily-config.json`: the three NTOU addresses plus `edkong17@gmail.com` and `xuemingwang28@gmail.com`. GitHub's `SMTP_PASS` secret can still be supplied, but the local `server/.env` takes priority for this self-hosted runner. Never commit passwords or tokens.

### Manual tests / 手動測試

In **Actions → Scraper → Run workflow**, enter `target` as the number of articles **per source/category pair** (1–100; default 20), not a global total. Across the 30 configured source/category pairs, the default target is 600 articles; publication quality checks can produce fewer articles and an explicit partial result. Choose `scrape` for daily ingestion. If the edition is already complete, it exits successfully with `ingestion_already_complete`; the target does not force a second run. A failed daily run cannot be retried after its original deadline. Choose `full-recheck` for a fresh, bounded recheck without sending email or rewriting an existing edition; this is the recovery option after the cutoff. `cleanup` is a preview, and `backfill-lang` is a separate database maintenance action.

In **Actions → NewsAgg Daily Publish and Report → Run workflow**, the optional `recipients` field accepts comma-separated email addresses. With `save_recipients` off, they apply only to that manual run. Turn `save_recipients` on to **add** them to the repository's `REPORT_EMAIL_TO` variable for future scheduled runs; the five addresses in `ops/daily-config.json` are always retained. The self-hosted runner must have the existing GitHub credential used to manage that variable. A blank recipient field cannot be saved. `preflight` validates dependencies without sending email, even when saving recipients. Choose `send` only when you intend to send the real daily edition to the manually entered addresses; the delivery ledger prevents resending already accepted recipients. Scheduled runs use the configured five plus saved additions. Do not use `scripts\GITHUB-DAILY-PUBLISH.ps1`; the daily email is sent only by **NewsAgg Daily Pipeline**.

每日排程由 Windows 工作排程器負責，GitHub Actions 保留手動操作與復原功能；請保持電腦登入、Docker 與網路運作。手動測試 Scraper 時，`scrape` 使用每日執行紀錄；若當日已完成，會安全結束而不重複擷取。超過原始截止時間後，請用 `full-recheck` 重新檢查；此操作不寄送每日郵件，也不改寫已凍結的版本。手動輸入的收件者可選擇只用於本次執行，或勾選 `save_recipients` 將其加入未來排程收件者；既有五位收件者會保留。
