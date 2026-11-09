import { createHash, randomBytes } from 'node:crypto'
import type { Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { JWT_SECRET } from '../config'
import { query } from '../db/client'
import { clientIp } from './clientIp'

export const SESSION_COOKIE = 'newsagg_session'
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000

export function sessionHash(raw: string) {
  return createHash('sha256').update(raw).digest('hex')
}

function isSecureRequest(req: Request) {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim()
  return req.secure || forwardedProto === 'https'
}

export function setSessionCookie(req: Request, res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isSecureRequest(req),
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_MS,
  })
}

export function clearSessionCookie(req: Request, res: Response) {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: isSecureRequest(req),
    sameSite: 'lax',
    path: '/',
  })
}

export async function createSession(userId: number | string, req: Request) {
  const sessionId = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
  // The visitor's address, not the Cloudflare Worker's (see lib/clientIp).
  const ip = clientIp(req)
  const userAgent = String(req.headers['user-agent'] || '').slice(0, 512) || null
  await query(
    `DELETE FROM account_sessions
     WHERE user_id = $1 AND (expires_at < now() OR revoked_at < now() - interval '30 days')`,
    [userId]
  )
  await query(
    `INSERT INTO account_sessions
       (token_hash, user_id, user_agent, ip_address, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [sessionHash(sessionId), userId, userAgent, ip, expiresAt]
  )
  return jwt.sign({ userId, sessionId }, JWT_SECRET, { expiresIn: '7d' } as jwt.SignOptions)
}
