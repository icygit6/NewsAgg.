import * as Sentry from '@sentry/node'
import { IS_PROD } from '../config'

// Opt-in error monitoring. With no SENTRY_DSN set, initSentry() is a no-op and
// nothing is ever sent off-box — the server behaves identically without an
// account. Set SENTRY_DSN to turn it on.
const dsn = process.env.SENTRY_DSN
export const sentryEnabled = Boolean(dsn)

export function initSentry() {
  if (!dsn) return
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENV || (IS_PROD ? 'production' : 'development'),
    // Tracing is off by default; raise SENTRY_TRACES_SAMPLE_RATE (0..1) to sample.
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),
  })
}

export { Sentry }
