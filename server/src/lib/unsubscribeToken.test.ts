import { describe, expect, it } from 'vitest'
import { JWT_SECRET } from '../config'
import { signUnsubscribeToken, verifyUnsubscribeToken } from './unsubscribeToken'

// The daily-email script (plain Node, no TypeScript) signs the links; the
// server verifies them. They must agree byte for byte.
async function script() {
  const path = '../../scripts/daily-subscribers.mjs'
  return (await import(/* @vite-ignore */ path)) as {
    unsubscribeKey: (env: Record<string, string>) => Buffer
    signUnsubscribeToken: (userId: number, key: Buffer) => string
  }
}

describe('unsubscribe tokens', () => {
  it('round-trips a user id', () => {
    expect(verifyUnsubscribeToken(signUnsubscribeToken(42))).toBe(42)
  })

  it('accepts a token the email script signed', async () => {
    const mod = await script()
    const token = mod.signUnsubscribeToken(77, mod.unsubscribeKey({ JWT_SECRET }))
    expect(verifyUnsubscribeToken(token)).toBe(77)
    expect(token).toBe(signUnsubscribeToken(77))
  })

  it('rejects a token issued for a different user', () => {
    const [, mac] = signUnsubscribeToken(1).split('.')
    expect(verifyUnsubscribeToken(`2.${mac}`)).toBeNull()
  })

  it('rejects malformed, truncated and oversized input', () => {
    const good = signUnsubscribeToken(5)
    for (const bad of [undefined, null, 5, '', 'x', '5', '5.', `${good}x`, good.slice(0, -1), `0.${good.split('.')[1]}`, `-5.${good.split('.')[1]}`, 'a'.repeat(500)]) {
      expect(verifyUnsubscribeToken(bad)).toBeNull()
    }
  })

  it('refuses to sign for an invalid user id', () => {
    expect(() => signUnsubscribeToken(0)).toThrow()
    expect(() => signUnsubscribeToken(1.5)).toThrow()
  })
})
