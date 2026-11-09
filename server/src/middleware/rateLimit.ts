import rateLimit from 'express-rate-limit'
import type { Request } from 'express'
import { clientIp, ipBucket } from '../lib/clientIp'
import { tokenUserId } from './auth'

// Limits keyed by address use the visitor's real IP (see lib/clientIp): behind
// the Cloudflare Worker, req.ip is the Worker for everyone.
const byIp = (req: Request) => ipBucket(clientIp(req))

// Cheap reads the app makes on every page or poll. Counting them against the
// shared budget is what locked readers out of their own profile when it ran out.
const UNMETERED = new Set(['/api/account/me', '/api/stats/revision', '/api/config/public'])

export const explanationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  keyGenerator: byIp,
  message: { success: false, message: 'Too many explanation requests — try again later' },
})

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 600, // SPA traffic: paginated feed + per-article fetches add up fast
  // Signed-in readers get their own budget even when they share an address
  // (a campus or office network); everyone else is counted per visitor IP.
  keyGenerator: (req: Request) => {
    const userId = tokenUserId(req)
    return userId ? `user:${userId}` : byIp(req)
  },
  skip: (req: Request) => req.method === 'GET' && UNMETERED.has(req.path),
  message: { success: false, message: 'Too many requests' }
})

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyGenerator: byIp,
  message: { success: false, message: 'Too many auth attempts' }
})

// Expensive upstream calls (Groq chat, Gemini/Lingva translation) get their
// own tight buckets so a single client cannot burn the free-tier quotas.
export const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  // chatRouter authenticates before this limiter, so each account receives an
  // independent quota even when many users share the same proxy IP.
  keyGenerator: (req: any) => `user:${req.userId}`,
  message: { success: false, message: 'Too many chat requests — try again later' }
})

// Post creation is the only spam-prone write; likes/deletes stay on apiLimiter.
export const postLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req: any) => `user:${req.userId}`,
  message: { success: false, message: 'Too many posts — try again later', error: 'Too many posts — try again later' }
})

export const commentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  keyGenerator: (req: any) => `user:${req.userId}`,
  message: { success: false, error: 'Too many comments — try again later' },
})

export const likeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  keyGenerator: (req: any) => `user:${req.userId}`,
  message: { success: false, error: 'Too many reactions — try again later' },
})

// Article corrections are open to signed-out readers, so they are keyed by IP.
export const articleReportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: byIp,
  message: { success: false, message: 'Too many reports — try again later' },
})

// Feedback is open to signed-out readers too, so it is keyed by IP.
export const feedbackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: byIp,
  message: { success: false, error: 'Too much feedback at once — try again in a few minutes' },
})

export const translateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  keyGenerator: byIp,
  message: { success: false, message: 'Too many translation requests — try again later' }
})

export const accountWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  keyGenerator: (req: any) => `user:${req.userId}`,
  message: { success: false, error: 'Too many account changes — try again later' },
})
