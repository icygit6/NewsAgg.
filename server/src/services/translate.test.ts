import { describe, expect, it } from 'vitest'
import { splitTranslationText } from './translate'

describe('translation chunking', () => {
  it('keeps every paragraph and respects the requested maximum', () => {
    const text = ['First paragraph.', 'Second paragraph is longer.', 'Third paragraph.'].join('\n\n')
    const chunks = splitTranslationText(text, 30)
    expect(chunks.every((chunk) => chunk.length <= 30)).toBe(true)
    expect(chunks.join('\n\n')).toContain('First paragraph.')
    expect(chunks.join('\n\n')).toContain('Third paragraph.')
  })

  it('splits a single oversized paragraph instead of truncating it', () => {
    const text = 'x'.repeat(125)
    const chunks = splitTranslationText(text, 50)
    expect(chunks.map((chunk) => chunk.length)).toEqual([50, 50, 25])
    expect(chunks.join('')).toBe(text)
  })
})
