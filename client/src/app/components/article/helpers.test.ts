import { expect, it } from 'vitest';
import { formatAccessStatus, formatCountryName, formatLanguageName } from './helpers';
import type { NewsArticle } from '../../types/article';

it('expands country and language codes in the interface locale', () => {
  expect(formatCountryName('GB')).toBe('United Kingdom');
  expect(formatCountryName('TW')).toBe('Taiwan');
  expect(formatLanguageName('en')).toBe('English');
  expect(formatLanguageName('zh-TW')).toContain('Chinese');
  expect(formatCountryName('GB', 'zh-TW')).not.toBe('GB');
  expect(formatLanguageName('zh_TW', 'zh-TW')).not.toBe('ZH_TW');
  expect(formatCountryName(null)).toBe('Not provided');
});

it('does not infer paywall status from missing metadata', () => {
  const article = { isPremium: false, isAccessibleFree: null } as NewsArticle;
  expect(formatAccessStatus(article)).toBe('Not specified by publisher');
  expect(formatAccessStatus({ ...article, isAccessibleFree: true })).toBe('Free access');
  expect(formatAccessStatus({ ...article, isAccessibleFree: false })).toBe('Restricted');
});
