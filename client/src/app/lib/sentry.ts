import * as Sentry from '@sentry/react';

// Opt-in error monitoring. With no VITE_SENTRY_DSN set, initSentry() is a no-op
// and nothing is sent anywhere — the app builds and runs identically without it.
const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;

export function initSentry() {
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? 0),
  });
}
