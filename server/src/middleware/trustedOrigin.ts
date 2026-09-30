import type { NextFunction, Request, Response } from 'express'
import { CORS_ORIGINS } from '../config'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/** Reject browser cross-site writes before they reach cookie-authenticated routes. */
export function requireTrustedOrigin(req: Request, res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method)) return next()

  const fetchSite = String(req.headers['sec-fetch-site'] || '').toLowerCase()
  if (fetchSite === 'cross-site') {
    return res.status(403).json({ success: false, error: 'Cross-site request rejected' })
  }

  const origin = req.headers.origin
  if (!origin) return next() // non-browser/API clients authenticate explicitly
  const forwardedHost = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim()
  const forwardedProto = String(req.headers['x-forwarded-proto'] || req.protocol || 'http').split(',')[0].trim()
  if (forwardedHost && origin === `${forwardedProto}://${forwardedHost}`) return next()
  if (CORS_ORIGINS === true || (Array.isArray(CORS_ORIGINS) && CORS_ORIGINS.includes(origin))) return next()
  return res.status(403).json({ success: false, error: 'Untrusted request origin' })
}
