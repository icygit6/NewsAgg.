import { createHash, randomBytes } from 'crypto'
import { query } from '../db/client'

// Single-use auth tokens (password reset, email verification). The RAW token
// is what goes in the email link; only its sha256 hash is ever persisted, so a
// database leak cannot be replayed against the reset/verify endpoints.

export const RESET_TOKEN_TTL_MS = 1000 * 60 * 30 // 30 minutes
export const VERIFY_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 // 24 hours

export function generateToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString('hex')
  return { raw, hash: hashToken(raw) }
}

export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

// Issue a single-use token of the given kind, storing only its hash. Any
// previous unused token of the same kind for this user is dropped first, so a
// user only ever has one outstanding reset / verify link.
export async function issueToken(userId: number | string, kind: 'reset' | 'verify', ttlMs: number) {
  const { raw, hash } = generateToken()
  const expiresAt = new Date(Date.now() + ttlMs)
  await query('DELETE FROM auth_tokens WHERE user_id = $1 AND kind = $2 AND used_at IS NULL', [
    userId,
    kind,
  ])
  await query(
    'INSERT INTO auth_tokens (user_id, token_hash, kind, expires_at) VALUES ($1, $2, $3, $4)',
    [userId, hash, kind, expiresAt]
  )
  return raw
}
