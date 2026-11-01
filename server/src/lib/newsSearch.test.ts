import { expect, it } from 'vitest'
import { newsSearch } from './newsSearch'
it('uses word boundaries and the expanded AI name instead of substring matches', () => {
  const values: unknown[] = [];
  expect(newsSearch('AI', values)).toContain('a.title ~* $1');
  expect(values).toEqual(['\\mAI\\M|\\martificial\\s+intelligence\\M|人工智慧|人工智能']);
});
it('requires all query terms and escapes regex punctuation', () => {
  const values: unknown[] = ['existing'];
  const sql = newsSearch('AI chips (2026)', values);
  expect(sql).toContain(' AND ');
  expect(sql).toContain('$4');
  expect(values[2]).toBe('\\mchips\\M');
  expect(values[3]).toBe('\\(2026\\)');
});
