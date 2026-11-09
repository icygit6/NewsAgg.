import { expect, it } from 'vitest'
import { profileSchema, registerSchema, toUsername } from './validate'

const base = { email: 'reader@example.test', password: 'long-enough-1', termsAccepted: true as const }

it('accepts every kind of name in use: Latin, Chinese, digits, spaces', () => {
  for (const username of ['AkiraKira22', '張欽平', '01257168', 'Edmund Kong', 'news_agg-2.0']) {
    expect(registerSchema.safeParse({ ...base, username }).success).toBe(true)
    expect(profileSchema.safeParse({ username }).success).toBe(true)
  }
})

it('refuses characters that would break the profile link', () => {
  for (const username of ['tom#1', 'who?me', 'a/b/c', 'fifty%off', 'emoji😀x']) {
    expect(registerSchema.safeParse({ ...base, username }).success).toBe(false)
    expect(profileSchema.safeParse({ username }).success).toBe(false)
  }
})

it('cleans a Google display name into an allowed username', () => {
  expect(toUsername("Dr. O'Brien #1")).toBe('Dr. OBrien 1')
  expect(toUsername('  陳 小明 😀 ')).toBe('陳 小明')
  expect(toUsername('???')).toBe('')
})
