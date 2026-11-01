# Public web recovery

NewsAgg serves its application from the Acer laptop through Docker and a Cloudflare Quick Tunnel. The Worker URL is stable; the temporary upstream URL is not. Recovery does not make the laptop an always-on cloud server.

## Install and prerequisites

Run `npm ci` in `deploy/stable-origin`, then run `scripts\INSTALL-WEB-RECOVERY.ps1` from the repository root. The installer registers **NewsAgg Web Recovery**, a hidden task for the current Windows user, at logon and every two minutes. `wscript.exe` runs `ops/run-hidden.vbs`, which starts Node with window style 0 and preserves its exit code. This avoids the brief console popup that can occur when Task Scheduler starts PowerShell directly. It uses the pinned local Wrangler package and the user's existing Cloudflare authentication. No credentials are written into the task or source files.

The laptop must be awake, the user logged in, and Docker's server, client and tunnel containers running. Internet access and valid Cloudflare credentials are required. If credentials expire, authenticate Wrangler again as the same Windows user. Docker Desktop is not started by this task, and deliberately stopped containers stay stopped. The existing ingestion and email schedules are unchanged.

## Recovery policy

1. A healthy public `/health` response with `ok: true` and `db: up` requires no repair.
2. While offline, with Docker unavailable, or with local application/database health failing, do not rotate the tunnel.
3. Require two failed checks before repair; allow at most one repair attempt per ten minutes. Allow newly starting tunnels to finish.
4. If the running tunnel is unhealthy or its current URL cannot be recovered, restart only `tunnel`. Cache its temporary URL together with its container ID and start timestamp so old-generation URLs cannot be reused.
5. Check the temporary origin before calling `scripts\UPDATE-STABLE-ORIGIN.ps1`. A healthy tunnel with a stale Worker needs an origin update, not another restart.
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

Tests: `node --test server/scripts/web-recovery.test.mjs` (recovery policy and URL validation).
