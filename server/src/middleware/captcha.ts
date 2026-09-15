import { Request, Response, NextFunction } from 'express'
import { logger } from '../lib/logger'

// Cloudflare Turnstile CAPTCHA. Opt-in: when TURNSTILE_SECRET is unset the
// middleware is a no-op, so local dev and the unit tests run with zero config —
// the same graceful-degradation pattern as mailer.ts / Sentry.
const SECRET = process.env.TURNSTILE_SECRET || ''
const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

export const captchaConfigured = (): boolean => SECRET.length > 0

// Adaptive login: a client only has to solve a CAPTCHA after several failed
// logins from its IP within the window. Tracked in-process (good enough for a
// single instance; swap for Redis if you scale out horizontally).
const FAIL_WINDOW_MS = 15 * 60 * 1000
const FAIL_THRESHOLD = 3
const failures = new Map<string, { count: number; expires: number }>()

function failKey(req: Request): string {
  return req.ip || 'unknown'
}

/** True once this IP has crossed the failed-login threshold (and the window
 * hasn't lapsed). The client uses the `captchaRequired` flag we echo back to
 * decide when to render the widget. */
export function loginNeedsCaptcha(req: Request): boolean {
  if (!captchaConfigured()) return false
  const entry = failures.get(failKey(req))
  if (!entry) return false
  if (entry.expires < Date.now()) {
    failures.delete(failKey(req))
    return false
  }
  return entry.count >= FAIL_THRESHOLD
}

export function recordLoginFailure(req: Request): void {
  const key = failKey(req)
  const now = Date.now()
  const entry = failures.get(key)
  if (!entry || entry.expires < now) {
    failures.set(key, { count: 1, expires: now + FAIL_WINDOW_MS })
  } else {
    entry.count += 1
  }
}

export function clearLoginFailures(req: Request): void {
  failures.delete(failKey(req))
}

/** Verify a Turnstile response token against Cloudflare. Returns true when
 * CAPTCHA is not configured (inert) or the token is valid. Fails open on a
 * network/parse error — rate limiting still caps abuse, and we'd rather not
 * lock everyone out if Cloudflare is briefly unreachable. */
async function verifyTurnstile(token: unknown, ip?: string): Promise<boolean> {
  if (!captchaConfigured()) return true
  if (typeof token !== 'string' || token.length === 0) return false
  try {
    const body = new URLSearchParams({ secret: SECRET, response: token })
    if (ip) body.append('remoteip', ip)
    const res = await fetch(VERIFY_URL, { method: 'POST', body })
    const data = (await res.json()) as { success?: boolean }
    return data.success === true
  } catch (err) {
    logger.error({ err }, 'turnstile verify request failed — failing open')
    return true
  }
}

function rejectCaptcha(res: Response) {
  return res.status(400).json({
    success: false,
    message: 'CAPTCHA verification failed',
    error: 'CAPTCHA verification failed',
    captchaRequired: true,
  })
}

/** Always require a valid CAPTCHA (register, forgot-password). No-op when
 * unconfigured. Must run before `validateBody`, which strips `captchaToken`. */
export async function requireCaptcha(req: Request, res: Response, next: NextFunction) {
  if (!captchaConfigured()) return next()
  const ok = await verifyTurnstile(req.body?.captchaToken, req.ip)
  if (!ok) return rejectCaptcha(res)
  next()
}

/** Adaptive gate for login: only demands a CAPTCHA once this IP has tripped the
 * failed-login threshold. Below it, sign-in stays frictionless. */
export async function loginCaptchaGate(req: Request, res: Response, next: NextFunction) {
  if (!loginNeedsCaptcha(req)) return next()
  const ok = await verifyTurnstile(req.body?.captchaToken, req.ip)
  if (!ok) return rejectCaptcha(res)
  next()
}
