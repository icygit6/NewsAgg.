# NewsAgg free-only deployment

This deployment intentionally avoids a custom domain, a named Cloudflare
Tunnel, and GitHub-hosted runner usage. The laptop, Docker Desktop, and the
GitHub self-hosted runner must remain online for the public site and schedules.

## Public access

`START-NEWSAGG.ps1` starts a free Cloudflare Quick Tunnel. It requires no
Cloudflare account, tunnel token, DNS record, or purchased domain.

```powershell
.\START-NEWSAGG.ps1
.\SHOW-PUBLIC-URL.ps1
```

The generated `https://*.trycloudflare.com` address is temporary and changes
whenever the tunnel container is recreated. Quick Tunnel is intended for demos:
Cloudflare provides no uptime guarantee, limits it to 200 concurrent in-flight
requests, and does not support Server-Sent Events.

The 05:00 workflow intentionally recreates the tunnel, applies the new address
to the server for account-email links, and emails the new address and news
brief. IIS is not used.

## Free-only scheduled jobs

- 03:00 Asia/Taipei: scrape news on the laptop self-hosted runner.
- 05:00 Asia/Taipei: rotate the Quick Tunnel and send the email report on the
  same self-hosted runner.
- Sunday 04:00 Asia/Taipei: clean old database rows on the self-hosted runner.

No workflow uses `ubuntu-latest` or another GitHub-hosted runner. This prevents
the private repository from consuming metered GitHub-hosted minutes.

## Required local configuration

Copy the example files if they do not exist, then keep the completed files out
of Git:

```powershell
Copy-Item compose.env.example .env
Copy-Item server.env.example server/.env
.\CONFIGURE-PRODUCTION.ps1
```

`server/.env` must contain a PostgreSQL connection (`NEONDB_URL`) and an
application secret (`SECRET_KEY`). The current Neon database can stay on its
free allowance; do not enable a paid plan or usage overage for this project.

## Optional integrations

These integrations are optional and the application starts without them:

- `GEMINI_API_KEY`: translation uses Gemini when configured and otherwise tries
  the no-key Lingva fallback.
- `GROQ_API_KEY`: enables article chat. Without it, AI chat is unavailable.
- `GOOGLE_CLIENT_ID`: enables Google Sign-In. A rotating Quick Tunnel URL must
  be added as an authorized JavaScript origin after each rotation; ordinary
  email/password login does not have this restriction.
- `TURNSTILE_SECRET` and `VITE_TURNSTILE_SITE_KEY`: optional free CAPTCHA.
- `SENTRY_DSN`, `MEM0_API_KEY`, `FAVQS_API_KEY`, and `TWELVE_DATA_API_KEY`:
  optional. Leave them empty to avoid external plans or quotas. Finance falls
  back to no-key public data sources when Twelve Data is empty.
- `HF_TOKEN`: optional for downloading Hugging Face models; local cached models
  continue to work without a paid inference service.

Free tiers still have provider quotas. Do not upgrade a provider account or add
a payment method unless you deliberately choose to do so.

## Gmail delivery

Email uses Gmail SMTP with a Google App Password; it is not a paid email API.
Configure `SMTP_USER` and `SMTP_PASS` as GitHub Actions secrets and set
`REPORT_EMAIL_TO` as a repository variable. Multiple recipients may be
comma-separated.

## Validate

```powershell
docker compose config --quiet
.\CHECK-NEWSAGG.ps1
Invoke-RestMethod http://127.0.0.1:3000/health
Invoke-RestMethod http://127.0.0.1:3000/api/markets/summary
```
