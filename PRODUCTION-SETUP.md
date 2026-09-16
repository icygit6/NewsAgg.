# NewsAgg production activation

The repository is prepared for a permanent Cloudflare Tunnel, runtime Google
Sign-In configuration, account email, a keyed finance provider, grounded AI
chat, and scheduled scraping/reporting. Credentials and the domain must still
be created in their respective provider dashboards.

## 1. Rotate credentials that appeared in screenshots or chat

- Revoke the old Google App Password and generate a new one.
- Revoke the old Hugging Face token and generate a new one.
- Never commit `server/.env`, `server/.hf.env`, or the root `.env`.

## 2. Create a permanent Cloudflare Tunnel

1. Put the domain on Cloudflare.
2. In Cloudflare Zero Trust, create a tunnel named `NewsAgg`.
3. Add a public hostname such as `news.example.com`.
4. Set the hostname service to `http://client:80`.
5. In the root `.env`, set:

   ```env
   CLOUDFLARE_TUNNEL_TOKEN=replace-with-token
   PUBLIC_CLIENT_URL=https://news.example.com
   CLIENT_URL=https://news.example.com,http://localhost:8080,http://localhost
   TRUST_PROXY=1
   ```

`START-NEWSAGG.ps1` automatically selects the named tunnel when the token is
present. Without it, the script retains the temporary Quick Tunnel.

After creating the provider credentials, the values can be entered without
echoing secrets by running `CONFIGURE-PRODUCTION.ps1` in PowerShell.

## 3. Configure Google Sign-In

Create a Google OAuth Web client and register these exact JavaScript origins:

```text
https://news.example.com
http://localhost:8080
```

Put the client ID in `server/.env`:

```env
GOOGLE_CLIENT_ID=replace.apps.googleusercontent.com
```

The browser obtains this public identifier at runtime from
`/api/config/public`; duplicating it into the client build is optional.

## 4. Configure account email

Put the newly generated 16-character Google App Password in `server/.env`
without spaces:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=0
SMTP_USER=sender@gmail.com
SMTP_PASS=replace-with-new-app-password
MAIL_FROM=NewsAgg <sender@gmail.com>
PUBLIC_CLIENT_URL=https://news.example.com
```

GitHub Actions uses separate `SMTP_USER` and `SMTP_PASS` repository secrets.
Set repository variables `REPORT_EMAIL_TO`, `MAIL_FROM`, and
`PUBLIC_CLIENT_URL`. Multiple recipients may be comma-separated.

## 5. Configure market indices

Create a Twelve Data API key and set it in both the root `.env` and (for direct
non-Compose server runs) `server/.env`:

```env
TWELVE_DATA_API_KEY=replace-with-key
```

Twelve Data is primary; Stooq remains a fallback. The server persists the last
valid snapshot in the `market_cache` Docker volume and exposes provider,
timestamp, stale, and unavailable metadata.

## 6. Start and validate

```powershell
.\START-NEWSAGG.ps1
.\SHOW-PUBLIC-URL.ps1
docker compose ps
Invoke-RestMethod http://127.0.0.1:3000/health
Invoke-RestMethod http://127.0.0.1:3000/api/markets/summary
```

Test from mobile data: home feed, Google login, registration verification,
password reset, translation, signed-in article chat, and markets. IIS is not
part of this path and may stay stopped.

## 7. Schedules

- Scraper: 03:00 Asia/Taipei (`19:00 UTC` in GitHub Actions).
- Daily email: 05:00 Asia/Taipei (`21:00 UTC`).
- The email runner is self-hosted, so the laptop, Docker Desktop, and GitHub
  runner service must be online.

## 8. Model-quality evaluation

Create a real, independently labelled JSONL dataset and run:

```powershell
python scraper/evaluate_sentiment.py path\to\sentiment-gold.jsonl
```

The report includes accuracy, macro-F1, per-label F1, a confusion matrix, and
model usage. Do not tune thresholds until this dataset exists.
