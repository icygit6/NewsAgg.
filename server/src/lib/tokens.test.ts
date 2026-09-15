import { describe, it, expect } from 'vitest'
import { generateToken, hashToken } from './tokens'

describe('auth tokens', () => {
  it('generates a 64-char hex raw token whose sha256 hash matches hashToken', () => {
    const { raw, hash } = generateToken()
    expect(raw).toMatch(/^[0-9a-f]{64}$/)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(hash).toBe(hashToken(raw))
  })

  it('produces unique raw tokens and stable, collision-free hashes', () => {
    expect(generateToken().raw).not.toBe(generateToken().raw)
    expect(hashToken('abc')).toBe(hashToken('abc'))
    expect(hashToken('abc')).not.toBe(hashToken('abd'))
  })
})
