import 'dotenv/config'
import { initSentry, sentryEnabled, Sentry } from './lib/sentry'

// Initialise error monitoring before anything else runs. No-op unless SENTRY_DSN
// is set, so nothing is sent off-box by default.
initSentry()

import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import pinoHttp from 'pino-http'
import { CORS_ORIGINS } from './config'
import { logger } from './lib/logger'
import { pool } from './db/client'
import { newsRouter } from './routes/news'
import { articlesRouter } from './routes/articles'
import { marketsRouter } from './routes/markets'
import { statsRouter } from './routes/stats'
import { authRouter } from './routes/auth'
import { accountRouter } from './routes/account'
import { postsRouter } from './routes/posts'
import { bookmarksRouter } from './routes/bookmarks'
import { profilesRouter } from './routes/profiles'
import { userRouter } from './routes/user'
import { quotesRouter } from './routes/quotes'
import { translateRouter } from './routes/translate'
import { chatRouter } from './routes/chat'
import { apiLimiter, authLimiter } from './middleware/rateLimit'
import { mailerConfigured } from './services/mailer'
import { requireTrustedOrigin } from './middleware/trustedOrigin'
import { chatModelLabel } from './services/groq'

const app = express()
const PORT = process.env.PORT || 3001

// Behind a reverse proxy (docker nginx, Render, Railway…) the real client IP
// arrives in X-Forwarded-For; without trust proxy every visitor would share a
// single rate-limit bucket. Opt-in so a directly-exposed server stays strict.
if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1)

// Structured request logging. /health is excluded so liveness probes don't
// flood the logs.
app.use(
  pinoHttp({
    logger,
    autoLogging: { ignore: (req) => req.url === '/health' },
  })
)

app.use(helmet())
app.use(cors({ origin: CORS_ORIGINS, credentials: true }))
app.use(compression())
app.use(express.json({ limit: '200kb' }))
app.use(express.urlencoded({ extended: true, limit: '200kb' }))
app.use(requireTrustedOrigin)

app.use(apiLimiter)

// Public identifiers required by the browser at runtime. Keeping these behind
// the same-origin API avoids rebuilding the SPA whenever an OAuth client ID or
// Turnstile site key changes. No secret values are exposed here.
app.get('/api/config/public', (_req, res) => {
  res.set('Cache-Control', 'no-store')
  res.json({
    success: true,
    data: {
      googleClientId: process.env.GOOGLE_CLIENT_ID || '',
      turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || '',
      chatModelLabel: chatModelLabel(),
    },
  })
})

// Endpoints the client uses (same contract as the retired server.js, now on 3001)
app.use('/api/news-from-db', newsRouter)
app.use('/api/articles', translateRouter)
app.use('/api/articles', articlesRouter)
app.use('/api/markets', marketsRouter)
app.use('/api/stats', statsRouter)
app.use('/api/quotes', quotesRouter)
app.use('/api/chat', chatRouter)
app.use('/api/user', userRouter)
app.use('/api/account', accountRouter)
app.use('/api/posts', postsRouter)
app.use('/api/bookmarks', bookmarksRouter)
app.use('/api/profiles', profilesRouter)
app.use('/auth', authLimiter, authRouter)
// Backward-compatible direct-Docker API path. New clients use
// /api/bookmarks so IIS can reserve /bookmarks for the React page.
app.use('/bookmarks', bookmarksRouter)

// Liveness + readiness: pings the database so the probe fails when Postgres is
// unreachable instead of reporting healthy with a dead backend.
app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1')
    res.json({
      ok: true,
      db: 'up',
      integrations: {
        googleAuth: Boolean(process.env.GOOGLE_CLIENT_ID),
        captcha: Boolean(process.env.TURNSTILE_SECRET),
        smtp: mailerConfigured,
        translation: Boolean(process.env.GEMINI_API_KEY),
        chat: Boolean(process.env.GROQ_API_KEY),
        financePrimary: Boolean(process.env.TWELVE_DATA_API_KEY),
        publicUrl: /^https:\/\//i.test(process.env.PUBLIC_CLIENT_URL || ''),
      },
    })
  } catch (err) {
    logger.error({ err }, 'health check: database unreachable')
    res.status(503).json({ ok: false, db: 'down' })
  }
})

// JSON 404 for anything unmatched (used to fall through to Express' HTML 404).
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Not found', error: 'Not found' })
})

// Sentry's Express error handler captures 5xx before our responder runs. No-op
// registration is avoided entirely when monitoring is disabled.
if (sentryEnabled) Sentry.setupExpressErrorHandler(app)

// Global error handler: body-parser failures (bad JSON, oversized payloads)
// and anything routes throw land here. Internals are logged, never leaked.
// The 4-arg signature is required for Express to treat this as an error handler.
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status =
    typeof err?.status === 'number'
      ? err.status
      : typeof err?.statusCode === 'number'
        ? err.statusCode
        : 500
  if (status >= 500) logger.error({ err }, 'unhandled error')
  if (res.headersSent) return
  const message =
    status === 413 ? 'Payload too large' : status < 500 ? 'Bad request' : 'Internal server error'
  res.status(status).json({ success: false, message, error: message })
})

app.listen(PORT, () => logger.info(`Server running on ${PORT}`))
