import { afterEach, describe, expect, it } from 'vitest'
import { chatModelLabel } from './groq'

afterEach(() => {
  delete process.env.CHAT_MODEL_LABEL
})

describe('chatModelLabel', () => {
  it('names the configured chat model without its vendor prefix', () => {
    // Default GROQ_CHAT_MODEL is openai/gpt-oss-120b.
    expect(chatModelLabel()).toBe('GPT-OSS-120B')
  })

  it('prefers an explicit override', () => {
    process.env.CHAT_MODEL_LABEL = 'Groq GPT-OSS'
    expect(chatModelLabel()).toBe('Groq GPT-OSS')
  })
})
