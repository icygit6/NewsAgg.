import { expect, it } from 'vitest';
import { sentimentDecision } from './sentimentDecision';
import type { NewsSentiment } from '../types/sentiment';
const result = (type: NewsSentiment['type'], positive: number, neutral: number, negative: number): NewsSentiment => ({ type, probabilities: { positive, neutral, negative }, comparative: positive - negative, score: 0, model: 'general', hasStoredProbabilities: true });
it('explains the screenshot negative decision from stored scores', () => {
  expect(sentimentDecision(result('negative', .158, .309, .534))?.rule).toBe('negative-margin');
});
it('applies the neutral band before a positive polarity margin', () => {
  expect(sentimentDecision(result('neutral', .32, .52, .16))?.rule).toBe('neutral-band');
});
it('covers positive margin and highest-probability fallback', () => {
  expect(sentimentDecision(result('positive', .6, .3, .1))?.rule).toBe('positive-margin');
  expect(sentimentDecision(result('neutral', .3, .4, .3))?.rule).toBe('highest');
});
it('refuses to explain missing, invalid or conflicting saved evidence', () => {
  expect(sentimentDecision({ ...result('negative', .1, .2, .7), hasStoredProbabilities: false })).toBeNull();
  expect(sentimentDecision(result('positive', .1, .2, .7))).toBeNull();
  expect(sentimentDecision(result('neutral', 0, 0, 0))).toBeNull();
  expect(sentimentDecision(result('neutral', NaN, .4, .6))).toBeNull();
});
