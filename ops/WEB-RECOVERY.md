# Public web recovery

NewsAgg still serves its application from the Acer laptop through Docker and a Cloudflare Quick Tunnel. The Worker URL is stable; the temporary upstream URL is not. Recovery does not make the laptop an always-on cloud server.

## Install and prerequisites

Run `npm ci` in `deploy/stable-origin`, then run `INSTALL-WEB-RECOVERY.ps1` from the repository root. The installer registers **NewsAgg Web Recovery**, a hidden task for the current Windows user, at logon and every two minutes. `wscript.exe` runs `ops/run-hidden.vbs`, which starts Node with window style 0 and preserves its exit code. This avoids the brief console popup that can occur when Task Scheduler starts PowerShell directly. It uses the pinned local Wrangler package and the user's existing Cloudflare authentication. No credentials are written into the task or source files.

The laptop must be awake, the user logged in, and Docker's server, client and tunnel containers running. Internet access and valid Cloudflare credentials are required. If credentials expire, authenticate Wrangler again as the same Windows user. Docker Desktop is not started by this task, and deliberately stopped containers stay stopped. The existing ingestion and email schedules are unchanged.

## Recovery policy

1. A healthy public `/health` response with `ok: true` and `db: up` requires no repair.
2. While offline, with Docker unavailable, or with local application/database health failing, do not rotate the tunnel.
3. Require two failed checks before repair; allow at most one repair attempt per ten minutes. Allow newly starting tunnels to finish.
4. If the running tunnel is unhealthy or its current URL cannot be recovered, restart only `tunnel`. Cache its temporary URL together with its container ID and start timestamp so old-generation URLs cannot be reused.
5. Check the temporary origin before calling `UPDATE-STABLE-ORIGIN.ps1`. A healthy tunnel with a stale Worker needs an origin update, not another restart.
6. Verify the public health endpoint again. Deployment errors are logged without credential-bearing command output. Commands have bounded execution times, and an interrupted command's process tree is terminated. A process lock and scheduler `IgnoreNew` setting prevent overlapping recovery runs.

The script does not build images, scrape news, run the daily pipeline, or send email. A database outage or Cloudflare authentication failure requires separate investigation. There is no guaranteed recovery deadline or uptime SLA.

## Check and disable

State: `logs/web-recovery/state.json`. Bounded status log: `logs/web-recovery/recovery.log` plus one previous log. These files are ignored by Git.

```powershell
Get-ScheduledTaskInfo -TaskName 'NewsAgg Web Recovery'
Get-Content .\logs\web-recovery\state.json
node .\server\scripts\web-recovery.mjs
Disable-ScheduledTask -TaskName 'NewsAgg Web Recovery'
```

## Verification on 8 October 2026

- 23 automated recovery-policy and URL-validation tests pass; all five existing Worker tests pass.
- The initial failed tunnel logged `Unauthorized: Tunnel not found`; restarting it and updating the Worker restored public health.
- A controlled second tunnel restart changed the temporary URL. The scheduled recovery task detected the change, updated the origin and recorded `recovered`, followed by `healthy`.
- Public homepage, `/health` and the actual news endpoint `/api/news-from-db` returned HTTP 200. Health reported the database up.
- This validates origin-change recovery and the decision logic; it is not a physical Wi-Fi outage test, reboot test, long-term availability measurement or model-accuracy evaluation.
- The hidden `wscript.exe` launcher completed with scheduler result 0. No desktop visual assertion is implied by this process-level check.
- The full regression rerun passed 196 cases: server 63, client 23, scraper 49, Worker 5, pipeline/email 33, recovery 23. Both TypeScript checks passed. Scraper tests use a network-disabled disposable container, not the active ingestion container.

## Offline scraper dependency discovered during verification

The initial clean-container test lacked NLTK `cmudict`, causing two readability tests to error. The existing production container had downloaded the corpus at runtime. `scraper/Dockerfile` now downloads and validates it during image construction so a future clean container does not need that first-use download. See [NLTK data installation](https://www.nltk.org/data.html).

On this laptop, a full rebuild began resolving new unpinned dependencies and was stopped. The installed `website-scraper` image was instead incrementally extended from the existing image with its production corpus. The previous image is retained as `newsagg-scraper-before-corpus-20261008`. All 49 tests then passed without a corpus mount or network access. The active ingestion container was not interrupted; subsequent containers use the updated image. A full from-scratch dependency rebuild is not claimed as verified.
