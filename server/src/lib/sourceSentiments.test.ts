import { expect, it } from 'vitest';
import { sourceSentiments } from './sourceSentiments';

it('keeps source totals and individual sentiment counts distinct', () => {
  const bbc = { source_id: 'bbc', source_name: 'BBC', source_domain: 'bbc.com' };
  const cnn = { source_id: 'cnn', source_name: 'CNN', source_domain: 'cnn.com' };
  const result = sourceSentiments([
    { ...bbc, sentiment_type: 'positive' }, { ...bbc, sentiment_type: 'negative' },
    { ...bbc, sentiment_type: 'negative' }, { ...cnn, sentiment_type: 'neutral' },
  ]);
  expect(result.map(s => s.total)).toEqual([3, 1]);
  expect(result[0].sentiments).toEqual({ positive: 1, neutral: 0, negative: 2 });
  expect(result[1].sentiments).toEqual({ positive: 0, neutral: 1, negative: 0 });
  expect(sourceSentiments([])).toEqual([]);
});
