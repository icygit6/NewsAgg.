import { afterEach, expect, it } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ReadabilityPanel } from './ReadabilityPanel';
import type { NewsArticle } from '../../types/article';
const article = (language: string, scores = { fleschScore: null, fleschKincaid: null, smogIndex: null } as NewsArticle['readability']) => ({ language, readability: scores, source: { language } }) as NewsArticle;
afterEach(cleanup);
it('keeps all metric labels but explains non-English applicability', () => {
  render(<ReadabilityPanel article={article('zh-TW')} isDark={false} />);
  expect(screen.getByText('Reading grade')).toBeDefined();
  expect(screen.getByText('Flesch score')).toBeDefined();
  expect(screen.getByText('SMOG index')).toBeDefined();
  expect(screen.getAllByText('Not applicable')).toHaveLength(3);
});
it('does not turn a missing English metric into zero', () => {
  render(<ReadabilityPanel article={article('en')} isDark={false} />);
  expect(screen.getAllByText('Unavailable')).toHaveLength(3);
});
it.each([
  { id: 'yahoo_tw' },
  { name: 'Yahoo TW' },
  { name: 'Yahoo Taiwan' },
  { domain: 'tw.news.yahoo.com' },
])('hides readability for Yahoo Taiwan identified by %j', (source) => {
  const item: NewsArticle = { ...article('zh-TW'), source: {
    id: null, name: '', domain: null, country: null, logo: null, language: 'zh-TW', ...source,
  } };
  const { container } = render(<ReadabilityPanel article={item} isDark={false} />);
  expect(container).toBeEmptyDOMElement();
});
it('preserves real zero Flesch/grade scores, but not the SMOG short-text sentinel', () => {
  render(<ReadabilityPanel article={article('en', { wordCount:100, readingTimeMin:1, fleschScore:0, fleschKincaid:0, smogIndex:0 })} isDark={false} />);
  expect(screen.getAllByText('0.0')).toHaveLength(2);
  expect(screen.getByText('Unavailable')).toBeDefined();
});
