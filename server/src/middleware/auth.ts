import { Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { JWT_SECRET } from '../config'
import { query } from '../db/client'
import { SESSION_COOKIE, sessionHash } from '../lib/session'

export { SESSION_COOKIE }

function cookieToken(cookieHeader: string | undefined): string | undefined {
  if (!cookieHeader) return undefined
  for (const part of cookieHeader.split(';')) {
    const [rawName, ...rawValue] = part.trim().split('=')
    if (rawName === SESSION_COOKIE) {
      try {
        return decodeURIComponent(rawValue.join('='))
      } catch {
        return undefined
      }
    }
  }
  return undefined
}

function requestToken(req: any): string | undefined {
  const auth = req.headers.authorization
  const bearer = typeof auth === 'string' && auth.startsWith('Bearer ') ? auth.slice(7) : undefined
  // Keep Bearer support for scripts/API clients while browsers use the safer
  // HttpOnly cookie that JavaScript cannot read.
  return bearer || cookieToken(req.headers.cookie)
}

// Mirrors server.js verifyToken: pulls Bearer token, sets req.userId from
// the JWT { userId } payload. Error responses use the `error` field so the
// existing client services keep working unchanged.
export async function authMiddleware(req: any, res: Response, next: NextFunction) {
  const token = requestToken(req)
  if (!token) {
    return res.status(401).json({ success: false, error: 'No token provided' })
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number | string; sessionId?: string }
    if (!decoded.sessionId) {
      return res.status(401).json({ success: false, error: 'Session expired; please sign in again' })
    }
    const hash = sessionHash(decoded.sessionId)
    const session = await query(
      `SELECT 1 FROM account_sessions
       WHERE token_hash = $1 AND user_id = $2 AND revoked_at IS NULL AND expires_at > now()`,
      [hash, decoded.userId]
    )
    if (session.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Session expired; please sign in again' })
    }
    req.userId = decoded.userId
    req.sessionHash = hash
    next()
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired token' })
  }
}

export async function optionalAuth(req: any, _res: Response, next: NextFunction) {
  const token = requestToken(req)
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: number | string; sessionId?: string }
      if (decoded.sessionId) {
        const hash = sessionHash(decoded.sessionId)
        const session = await query(
          `SELECT 1 FROM account_sessions
           WHERE token_hash = $1 AND user_id = $2 AND revoked_at IS NULL AND expires_at > now()`,
          [hash, decoded.userId]
        )
        if (session.rows.length > 0) {
          req.userId = decoded.userId
          req.sessionHash = hash
        }
      }
    } catch {}
  }
  next()
}
