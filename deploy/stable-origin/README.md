# Stable, free Cloudflare front door

Address: **https://newsagg.sentsis.workers.dev**. The root `.env` (`NEWSAGG_STABLE_URL`),
the server's CORS and public origin, and the Worker deployment all use this address,
and it is registered as an Authorized JavaScript origin on the Google OAuth client.

The public `https://newsagg.<account>.workers.dev` hostname stays fixed. This Worker forwards to the current Quick Tunnel, so the Python/Node app still runs on the laptop. No KV, paid model, new database, or custom domain is required. Laptop/Docker downtime still means website downtime.

1. Sign in to the owner's Cloudflare account with Wrangler, using its official CLI.
2. From this directory deploy: `npx wrangler deploy --var NEWSAGG_ORIGIN:https://CURRENT.trycloudflare.com`.
3. Add the returned workers.dev origin to the **existing** Google OAuth client's Authorized JavaScript origins. This app currently uses the GIS popup credential flow, not a server redirect callback. Do not add wildcards or expose the client secret.
4. Set `NEWSAGG_STABLE_URL` in the root `.env` to that origin. `scripts\START-NEWSAGG.ps1`, the daily run and the **NewsAgg Web Recovery** task call `scripts\UPDATE-STABLE-ORIGIN.ps1`, which redeploys the Worker with the new upstream and verifies `/health`. The server uses the stable origin for `CLIENT_URL` / `PUBLIC_CLIENT_URL`. The Windows account running the scheduled job must also have Wrangler authorization.
5. Users open the stable URL, never the temporary tunnel URL.
6. Once, set the shared edge key: `npx wrangler secret put NEWSAGG_EDGE_KEY`, using the same value as `NEWSAGG_EDGE_KEY` in `server/.env`. Cloudflare reports the Worker, not the visitor, as the caller on its hop to the tunnel, so without this every visitor shares one rate limit. With it, the Worker passes each visitor's IP in `X-NewsAgg-Client-IP`, and the API trusts that header only when the key matches. Secrets survive redeploys, so the recovery script needs no change.

Cloudflare Free plan quotas apply. Repeat the login/rotation check after changing proxy or authentication behavior. Do not publish using someone else's Cloudflare account. If Docker or the tunnel is restarted outside the provided scripts, run `scripts\UPDATE-STABLE-ORIGIN.ps1` to reconnect the Worker to the new upstream; the Worker cannot discover an unannounced random tunnel URL on its own.

Ordinary startup and display commands preserve a healthy tunnel. Explicit rotation is available with `scripts\SHOW-PUBLIC-URL.ps1 -RefreshTunnel` when the health check fails (`ops/WEB-RECOVERY.md` describes the automatic recovery). Sessions still expire normally after seven days; a stable hostname does not bypass session expiry, logout, or Google security checks.

Tests: `node --test worker.test.mjs`.
