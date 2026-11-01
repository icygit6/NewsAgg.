import { expect, it, vi } from 'vitest';
vi.mock('./groq', () => ({ createChatCompletion: vi.fn(), PRIMARY_CHAT_MODEL: 'test-model', chunkArticle: (text: string) => [text] }));
import { validateExplanation, explainSentiment, resolveExplanation } from './sentimentExplanation';
import { createChatCompletion } from './groq';
const source = 'Residents face difficult years ahead. The report also mentions some optimism.';
const answer = { summary: 'The report focuses on difficult conditions facing residents.', reasons: [{ reason: 'The passage stresses prolonged hardship.', quote: 'Residents face difficult years ahead.' }] };
it('accepts only supporting quotations present in the stored text', () => {
  expect(validateExplanation(JSON.stringify(answer), source).reasons).toEqual(answer.reasons);
  expect(() => validateExplanation(JSON.stringify({ ...answer, reasons: [{ reason: 'An unsupported claim.', quote: 'A war has started.' }] }), source)).toThrow('Unsupported quote');
  expect(() => validateExplanation(JSON.stringify({ ...answer, reasons: [] }), source)).toThrow('Missing supporting evidence');
});
it('shares cached generation and refreshes when content changes', async () => {
  vi.mocked(createChatCompletion).mockResolvedValue({ model: 'test-model', choices: [{ message: { content: JSON.stringify({ ...answer, reasons: [{ reason: answer.reasons[0].reason, quoteId: 1 }] }) } }] } as any);
  const article = { title: 'A report of the local situation', content: source, sentiment_type: 'negative' };
  const [first, second] = await Promise.all([explainSentiment(article, 'en'), explainSentiment(article, 'en')]);
  expect(first).toEqual(second);
  expect(createChatCompletion).toHaveBeenCalledTimes(1);
  await explainSentiment({ ...article, content: source + ' Updated reporting.' }, 'en');
  expect(createChatCompletion).toHaveBeenCalledTimes(2);
});
it('resolves citations from server text and rejects invented excerpt identifiers', () => {
  const raw = JSON.stringify({ ...answer, reasons: [{ reason: answer.reasons[0].reason, quoteId: 1 }] });
  expect(resolveExplanation(raw, [source]).reasons[0].quote).toBe(source);
  expect(() => resolveExplanation(raw, [])).toThrow('Unknown source excerpt');
});
