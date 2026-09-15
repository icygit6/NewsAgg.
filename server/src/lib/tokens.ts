import { createHash, randomBytes } from 'crypto'

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
