import { createHash, createHmac, timingSafeEqual } from 'crypto'
import { JWT_SECRET } from '../config'

// Stateless, signed unsubscribe links for the daily email. Nothing is stored:
// the token is `<userId>.<hmac>`, so a link in an old email keeps working and
// cannot be forged for another account. The key is derived from the server
// secret with a purpose prefix, so a leaked link never doubles as a login token.
//
// server/scripts/daily-subscribers.mjs signs these with the same derivation;
// tests/dailySubscribers cross-checks the two implementations.

const key = () => createHash('sha256').update(`newsagg-unsubscribe:${JWT_SECRET}`).digest()
const mac = (userId: number) => createHmac('sha256', key()).update(`unsubscribe:${userId}`).digest('base64url')

export function signUnsubscribeToken(userId: number): string {
  if (!Number.isSafeInteger(userId) || userId <= 0) throw new Error('Invalid user id')
  return `${userId}.${mac(userId)}`
}

/** The user id the token was issued for, or null if it is malformed or forged. */
export function verifyUnsubscribeToken(token: unknown): number | null {
  if (typeof token !== 'string' || token.length > 120) return null
  const match = /^(\d{1,12})\.([A-Za-z0-9_-]{43})$/.exec(token)
  if (!match) return null
  const userId = Number(match[1])
  if (!Number.isSafeInteger(userId) || userId <= 0) return null
  const expected = Buffer.from(mac(userId))
  const given = Buffer.from(match[2])
  return expected.length === given.length && timingSafeEqual(expected, given) ? userId : null
}
