import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const generate = vi.hoisted(() => vi.fn())
vi.mock('@google/genai', () => ({ GoogleGenAI: class { models = { generateContent: generate } } }))
import { translateArticleFields, splitTranslationText } from './translate'
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('GEMINI_API_KEY', 'unit-test-not-a-key') })
afterEach(() => vi.unstubAllEnvs())
it('keeps every paragraph and respects the requested chunk maximum', () => {
  const text = ['First paragraph.', 'Second paragraph is longer.', 'Third paragraph.'].join('\n\n')
  const chunks = splitTranslationText(text, 30)
  expect(chunks.every(chunk => chunk.length <= 30)).toBe(true)
  expect(chunks.join('\n\n')).toContain('First paragraph.')
  expect(chunks.join('\n\n')).toContain('Third paragraph.')
})
it('splits an oversized paragraph without truncation', () => {
  const text = 'x'.repeat(125)
  const chunks = splitTranslationText(text, 50)
  expect(chunks.map(chunk => chunk.length)).toEqual([50, 50, 25])
  expect(chunks.join('')).toBe(text)
})
it('translates every long-body chunk and preserves field ownership', async () => {
  generate.mockImplementation(async (request: any) => ({ text: `譯文:${JSON.parse(request.contents).sourceText}` }))
  const content = ['A'.repeat(4000), 'B'.repeat(4000), 'Final paragraph'].join('\n\n')
  const result = await translateArticleFields({ title: 'Title', description: null, content, aiSummary: 'Summary' }, 'zh-TW')
  expect(result.provider).toBe('gemini')
  expect(result.title).toBe('譯文:Title')
  expect(result.aiSummary).toBe('譯文:Summary')
  expect(result.content).toContain('Final paragraph')
  expect(generate).toHaveBeenCalledTimes(splitTranslationText(content).length + 2)
  expect(generate.mock.calls.every(([r]) => r.config.systemInstruction.includes('Traditional Chinese'))).toBe(true)
})
it('never labels a truncated full article as translated', async () => {
  generate.mockResolvedValue({ text: '部分', candidates: [{ finishReason: 'MAX_TOKENS' }] })
  const content = 'Text '.repeat(400)
  const result = await translateArticleFields({ title: 'Title', description: null, content, aiSummary: null }, 'zh-TW')
  expect(result.provider).toBe('none')
  expect(result.content).toBe(content)
})
it('coalesces simultaneous requests for the same article and language', async () => {
  generate.mockImplementation(async () => ({ text: '測試' }))
  const fields = { title: 'Same request', description: null, content: null, aiSummary: null }
  const [a,b] = await Promise.all([translateArticleFields(fields, 'zh-TW'), translateArticleFields(fields, 'zh-TW')])
  expect(a).toEqual(b)
  expect(generate).toHaveBeenCalledTimes(1)
})
