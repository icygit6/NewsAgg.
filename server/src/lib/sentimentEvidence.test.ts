import { describe, expect, it } from 'vitest';
import { buildSentimentEvidence, type EvidenceArticle } from './sentimentEvidence';
const article = (id: string, sentiment_type: string, title: string): EvidenceArticle => ({ id, sentiment_type, title, description: null, topic: 'World', language: 'en' });
describe('sentiment evidence', () => {
  it('counts each article once per theme and supports Chinese text', () => {
    const result = buildSentimentEvidence([article('1', 'negative', 'War and missile attacks'), article('2', 'negative', '軍事衝突持續'), article('3', 'positive', 'A science breakthrough')]);
    expect(result.negative.count).toBe(2);
    expect(result.negative.themes[0]).toEqual({ label: 'Conflict and security', count: 2 });
    expect(result.negative.examples.map(row => row.id)).toEqual(['1', '2']);
    expect(result.positive.count).toBe(1);
    expect(result.neutral).toEqual({ count: 0, themes: [], examples: [] });
  });
  it('does not invent reasons for unmatched text and bounds supporting examples', () => {
    const result = buildSentimentEvidence(['1', '2', '3'].map(id => article(id, 'neutral', 'A quiet afternoon')));
    expect(result.neutral.count).toBe(3);
    expect(result.neutral.themes).toEqual([]);
    expect(result.neutral.examples).toHaveLength(2);
  });
});
