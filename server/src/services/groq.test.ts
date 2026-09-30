import { describe, expect, it } from 'vitest'
import { chunkArticle, selectRelevantChunks, rankRelevantChunks, normalizeCitationMarkers } from './groq'

describe('grounded article retrieval', () => {
  it('keeps short section headings together with the following facts', () => {
    const chunks = chunkArticle('Watford\n\nAlessio Dionisi is their manager.\n\nThey won two of eight league games and sit 19th.', 1400)
    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toContain('Watford\n\nAlessio Dionisi')
  })
  it('retrieves a final club section instead of generic league paragraphs', () => {
    const article = [
      ...Array.from({length:12}, (_,i) => `Club ${i}. ${'The manager discussed league games, wins and table positions this season. '.repeat(16)}`),
      'Watford', 'Alessio Dionisi became their manager during the summer.',
      'The club won two of its first eight league games.', 'They are 19th, three points above the drop zone.',
    ].join('\n\n')
    const question = 'Who manages Watford, how many of their first eight league games did they win, and where are they in the table?'
    expect(rankRelevantChunks(article, question)[0]).toContain('Watford')
    const selected = selectRelevantChunks(article, question).join('\n')
    expect(selected).toContain('Alessio Dionisi')
    expect(selected).toContain('19th')
    expect(chunkArticle(article).every(chunk => chunk.length <= 1400)).toBe(true)
  })
  it('normalizes provider citation brackets without altering the evidence number', () => {
    expect(normalizeCitationMarkers('The deadline is November 【4】 and the plan is confirmed ［2］.')).toBe('The deadline is November [4] and the plan is confirmed [2].')
  })
  it('does not split decimal numbers or duplicate text before oversized sentences', () => {
    expect(chunkArticle('Growth reached 2.5% this year. Next year is unknown.', 35).join(' ')).toContain('2.5%');
    const text = `Short first. ${'x'.repeat(100)}.`;
    expect(chunkArticle(text, 30).join(' ').match(/Short first\./g)).toHaveLength(1);
  })
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
