# NewsAgg

NewsAgg is a news aggregation platform with transformer-based sentiment analytics, an X-style three-column UI, a social posts feed, and a per-article AI chat.

## Architecture

```text
scraper/   Python — scrapes CNN / BBC / Al Jazeera / Yahoo TW, enriches with
           multilingual NLP (XLM-R sentiment, FinBERT for English business news,
           XLM-R NER, zero-shot topic, readability, toxicity) and upserts into
           PostgreSQL (Neon).
server/    Express + TypeScript API (port 3001) — articles, stats, markets,
           quotes, auth (email + Google, password reset, email verification,
           opt-in Cloudflare Turnstile CAPTCHA), account, bookmarks, posts,
           translate (Gemini→Lingva fallback), AI chat (Groq, multi-turn).
           Structured logging (pino) and opt-in Sentry error monitoring.
client/    React 18 + Vite + Tailwind v4 + React Query (port 5173) — X-style
           shell: NavRail · centre feed (filter-aware hero carousel + infinite
           list) · right rail (Insights analytics — the Business category adds a
           markets snapshot + 14-day pulse chart above the sentiment donut |
           Pulse posts+quotes feed).
```

The live database schema is authoritative (see `server/src/db/migrations/000_init_live_schema.sql`): `articles.id` is a TEXT sha256[:16] of the canonical URL, `sources.id` is a TEXT slug (`cnn`, `bbc`, …), `users.id` is an integer identity. Migrations are additive SQL files under `server/src/db/migrations/`, applied with `node scripts/migrate.mjs <file>.sql` from `server/`.

## Running locally

Backend (needs `server/.env` — see [`.env.example`](.env.example) for the full
variable list; on a fresh database apply the migrations under
`server/src/db/migrations/` with `node scripts/migrate.mjs <file>.sql`):

```powershell
cd server
npm install --legacy-peer-deps
npm run build
npm start
```

Password-reset and email-verification links are printed to the server console
unless SMTP is configured, so the flows are fully testable with no setup.

Frontend:

```powershell
cd client
npm install
npm start
```

Scraper (reads `server/.env` automatically; Yahoo TW needs Playwright Chromium):

```powershell
cd scraper
pip install -r requirements.txt
python run_all.py --target 15
```

Docker: `docker compose up -d --build` runs server + client; the scraper is an opt-in profile (`docker compose --profile scraper up scraper`).

## API surface (selected)

```text
GET  /api/news-from-db?category=&source=&sentiment=&q=&sort=rank|latest&page=&pageSize=&fields=summary
GET  /api/articles/:id            GET  /api/articles/:id/translate?lang=
GET  /api/stats/overview          GET  /api/stats/trending        GET  /api/stats/business-trend
GET  /api/markets/summary         GET  /api/quotes/random|list
POST /api/chat                    { message, articleContent, lang, messages? }  → multi-turn Groq
POST /auth/register|login|google                      GET/PATCH/PUT/DELETE /api/account/...   [Bearer]
POST /auth/forgot-password|reset-password|verify-email                 POST /auth/resend-verification [Bearer]
GET/POST /bookmarks               GET/POST/DELETE /api/posts (+ /:id/like)       [Bearer for writes]
GET  /health                      DB-backed liveness probe → 200 {ok:true} | 503 when Postgres is down
```

## Conventions

- One accent identity: cyan→pink brand gradient (`--brand*` tokens in `client/src/styles/tokens.css`); never name a custom token `--accent` — shadcn's `theme.css` owns that name and is imported later.
- Brand assets in `client/public/` (PWA icons, maskable icon, apple-touch icon, OG image) are generated from the cyan→pink "N" mark by `client/scripts/generate-brand-assets.py`; `favicon.svg` is hand-authored. The PWA manifest is `client/public/manifest.webmanifest`.
- All UI strings go through `client/src/app/i18n/translations.ts` (en / id / zh-CN / zh-TW).
- Server state lives in React Query hooks (`client/src/app/hooks/`); AppContext holds UI + identity only.
- The posts feature is gated by `POSTS_ENABLED` in `client/src/app/constants/index.ts`.
- Optional integrations degrade gracefully — Cloudflare Turnstile CAPTCHA, SMTP
  email, and Sentry are all inert until their env vars are set, so local dev and
  tests run with zero config.

### CAPTCHA (Cloudflare Turnstile)

Bot protection on the auth forms, enabled only when both keys are set
(`TURNSTILE_SECRET` on the server, `VITE_TURNSTILE_SITE_KEY` on the client); with
either unset the widget never renders and the server ignores any token. When and
where the challenge appears:

- **Create Account** and **Reset Password** — the widget always appears above the
  submit button, and a valid token is required before the request goes through.
- **Sign In** — frictionless by default. The widget appears *adaptively*, only
  after **3 failed logins from the same IP within 15 minutes** (the server echoes
  a `captchaRequired` flag once that threshold trips); a clean login clears the
  counter.
- **Google sign-in** is never challenged (the OAuth provider handles bot risk).

Verification fails open: if Cloudflare is briefly unreachable the request is
allowed through, so an outage can't lock everyone out — rate limiting still caps
abuse. The widget is single-use, so it remounts for a fresh token after each
submit.

### Why sign-up or sign-in can fail

Every condition below surfaces a specific message on the form (the server returns
a real 4xx/5xx with the reason; the client renders it):

- **Create account** — "Email or username already exists" (409); "Password must be
  at least 8 characters" / "Please fill in all fields" (client-side); CAPTCHA not
  solved → "Please complete the CAPTCHA".
- **Sign in (email)** — "User not found" or "Invalid password" (401); "This account
  signs in with Google" when the email has no password (Google-only account); after
  3 failed attempts/IP the CAPTCHA appears and must be solved.
- **Sign in (Google)** — common causes:
  - `origin_mismatch` (Google's own page) — the page's origin isn't in the OAuth
    client's **Authorized JavaScript origins**. Add `http://localhost:5173`,
    `http://localhost:4173` (and the `127.0.0.1` spellings) in Google Cloud Console.
  - "Access blocked / app doesn't comply" — the OAuth consent screen is in
    **Testing** mode and your account isn't a **test user**, or a Workspace admin
    blocks third-party apps. Add the account as a test user, or use a personal Gmail.
  - "Could not verify your Google sign-in…" — the ID token is expired or its
    audience ≠ the server's `GOOGLE_CLIENT_ID` (client and server client IDs must
    match; restart the server after changing `.env`).
  - "Google account email is missing or unverified" — the Google token has
    `email_verified:false` (some Workspace accounts); rejected to prevent takeover.
  - "Google sign-in is not configured on the server" — `GOOGLE_CLIENT_ID` unset.
- **Database not migrated** — if `002_auth_tokens.sql` hasn't been applied, register
  returns 500 and Google returns 401 (the routes touch `users.email_verified` /
  `auth_tokens`). Apply it with `node scripts/migrate.mjs 002_auth_tokens.sql`.

## Testing & quality

Run the same gates locally for the server and client before pushing:

```powershell
npm run lint        # ESLint (flat config)
npm run typecheck   # tsc --noEmit
npm test            # Vitest — server: auth routes + token helpers; client: components + services
npm run build
```

`npm run format` applies Prettier. Tests live next to the code as `*.test.ts(x)`.

Environment variables are documented in [`.env.example`](.env.example); the
authoritative database schema lives in `server/src/db/migrations/`.

## Performance & accessibility

The client is audited with Lighthouse against the production **preview** build
(not the dev server, which ships unminified and unbundled):

```powershell
cd client
npm run build
npm run preview     # serves the built app; run Lighthouse on the printed URL
```

Notable optimizations from the latest audit pass:

- **LCP / loading** — the hero carousel's lead image loads with
  `fetchPriority="high"`, `loading="eager"` and `decoding="async"`, and is painted
  at full opacity on first render (the cross-fade is skipped for the initial slide
  so the largest paint isn't held at `opacity:0`). `index.html` preconnects to the
  BBC/CNN image CDNs and to Google Fonts.
- **Accessibility** — carousel pagination dots are real `<button>`s with
  `aria-label` (`goToSlide`) / `aria-current` and 24px tap targets; the
  `health` and `science` category badges were darkened (emerald/teal 600 → 700)
  to clear WCAG contrast.
- **Best practices (clean console)** — Recharts panels only mount their
  `ResponsiveContainer` once the box has a non-zero size (`ui/ChartFrame.tsx`,
  no "width(0) and height(0)" warnings while a rail is hidden); the router ships a
  `HydrateFallback` for the initial lazy-route hydration
  (`components/RouteFallback.tsx`); and every form field carries a `name` +
  `autoComplete` so the browser can autofill and DevTools stops flagging
  unidentified fields.
