# NewsAgg scheduled automation / NewsAgg 排程自動化

Both scheduled workflows use the Windows self-hosted runner on this laptop.
Neither workflow uses billable GitHub-hosted compute.

- 03:00 Asia/Taipei: scrape all news sources.
- 05:00 Asia/Taipei: generate a new free Cloudflare Quick Tunnel URL and email
  the bilingual daily brief.
- Sunday 04:00 Asia/Taipei: database cleanup.

兩個排程工作流程都使用此筆記型電腦上的 Windows 自架執行器，不使用可能產生費用的
GitHub 託管運算資源。

## Self-hosted runner / 自架執行器

In the private repository, open **Settings > Actions > Runners > New
self-hosted runner**, choose **Windows x64**, and install it using the same
Windows account that runs Docker Desktop. Keep the runner, laptop, Docker
Desktop, and internet connection available at 03:00 and 05:00.

在私人儲存庫中開啟 **Settings > Actions > Runners > New self-hosted runner**，
選擇 **Windows x64**，並使用執行 Docker Desktop 的同一個 Windows 帳號安裝。

## Secrets and variables / 密鑰與變數

Open **Settings > Secrets and variables > Actions**.

Secrets:

- `SMTP_PASS`: 16-character Google App Password, with spaces removed.

Variables:

- `SMTP_HOST`: optional; defaults to `smtp.gmail.com`.
- `SMTP_PORT`: optional; defaults to `587`.

The sender and scheduled recipient list are saved directly in
`.github/workflows/newsagg-daily.yml`: sender `newsaggtest123@gmail.com`, with
recipients `01257166@email.ntou.edu.tw`, `01257168@email.ntou.edu.tw`, and
`01257169@email.ntou.edu.tw`. A manually dispatched run may temporarily override
the recipients without changing the saved schedule.

The scraper reads `D:\Website\server\.env` locally. GitHub no longer needs
`NEONDB_URL` or `HF_TOKEN` for the scraper workflow.

## Manual test / 手動測試

Open the repository **Actions** tab, select a workflow, and choose **Run
workflow**. The 05:00 workflow rotates the temporary URL and sends a real email.

在儲存庫的 **Actions** 頁面選擇工作流程並按下 **Run workflow**。05:00 的工作
流程會更換臨時網址並寄出真實郵件。
