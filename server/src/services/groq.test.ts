import { describe, expect, it } from 'vitest'
import { chunkArticle, selectRelevantChunks } from './groq'

describe('grounded article retrieval', () => {
  it('splits long articles without dropping text', () => {
    const text = `${'Alpha sentence. '.repeat(30)}\n\n${'Beta sentence. '.repeat(30)}`
    const chunks = chunkArticle(text, 120)
    expect(chunks.length).toBeGreaterThan(2)
    expect(chunks.join(' ')).toContain('Alpha sentence.')
    expect(chunks.join(' ')).toContain('Beta sentence.')
  })

  it('selects passages related to the question', () => {
    const article = [
      'The football club won its match.',
      'Taiwan Semiconductor reported record quarterly revenue and raised guidance.',
      'Heavy rain is expected tomorrow.',
      'The new chip factory will begin production next year.',
      'A film festival opened downtown.',
    ].join('\n\n')
    const selected = selectRelevantChunks(article, 'What happened to semiconductor and chip production?', 2)
    expect(selected.join(' ')).toMatch(/Semiconductor|chip factory/)
  })
})
