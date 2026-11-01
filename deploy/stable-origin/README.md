# Stable, free Cloudflare front door

Current address (22 September 2026): **https://newsagg.sentsis.workers.dev**.
The owner renamed the account subdomain to `sentsis`. Root `.env`, the running
server's CORS/public origin and the Worker deployment now use this address.
The initial TLS handshake failure cleared after redeploying the existing Worker;
no new Quick Tunnel was generated. Register this exact HTTPS origin on the
existing Google OAuth client once and sign in again on the new hostname.
Earlier email links and cookies on the previous hostname do not migrate.

Status: deployed on 20 September 2026 at https://newsagg.riyakavajravesaka.workers.dev using the owner's authorized Cloudflare account. Health, feed, article, posts, unauthenticated chat, and the upstream-update helper passed live checks. The owner registered the Google OAuth origin and signed in. A real tunnel recreation changed the upstream hostname; after Worker reconnection and a full browser reload, the same profile remained signed in, Google showed "Connected for sign-in", and the server-backed current-device session loaded without reauthentication. No paid Workers plan was enabled.

The public `https://newsagg.<account>.workers.dev` hostname stays fixed. This Worker forwards to the current Quick Tunnel, so the Python/Node app still runs on the laptop. No KV, paid model, new database, or custom domain is required. Laptop/Docker downtime still means website downtime.

1. Sign in to the owner's Cloudflare account with Wrangler, using its official CLI.
2. From this directory deploy: `npx wrangler deploy --var NEWSAGG_ORIGIN:https://CURRENT.trycloudflare.com`.
3. Add the returned workers.dev origin to the **existing** Google OAuth client's Authorized JavaScript origins. This app currently uses the GIS popup credential flow, not a server redirect callback. Do not add wildcards or expose the client secret.
4. Set `NEWSAGG_STABLE_URL` in the root `.env` to that origin. Startup and daily publish call `UPDATE-STABLE-ORIGIN.ps1`, which redeploys the Worker with the new upstream and verifies `/health`. The server uses the stable origin for `CLIENT_URL` / `PUBLIC_CLIENT_URL`. The Windows account running the scheduled job must also have Wrangler authorization.
5. Users should use the stable URL, not the temporary tunnel URL. Existing cookies cannot transfer from the old random hostname; a one-time login on the new stable hostname is expected.

Cloudflare Free plan quotas apply. Repeat the login/rotation check after changing proxy or authentication behavior. Do not publish using someone else's Cloudflare account. If Docker or the tunnel is restarted outside the provided scripts, run `UPDATE-STABLE-ORIGIN.ps1` to reconnect the Worker to the new upstream; the Worker cannot discover an unannounced random tunnel URL on its own.

Ordinary startup and display commands preserve a healthy tunnel. Explicit rotation is available with `GITHUB-DAILY-PUBLISH.ps1 -RotateTunnel` or `SHOW-PUBLIC-URL.ps1 -RefreshTunnel` when the health check fails. Sessions still expire normally after seven days; a stable hostname does not bypass session expiry, logout, or Google security checks.

Tests: `node --test worker.test.mjs`.
