import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useTranslate } from './useTranslate';
import { fetchArticleTranslation } from '../services/translateService';
import type { NewsArticle } from '../types/article';
vi.mock('../services/translateService', () => ({ LANGUAGE_API_CODE: { en:'en', zhTW:'zh-TW' }, fetchArticleTranslation: vi.fn() }));
const appState = vi.hoisted(() => ({ language: 'zhTW' as 'en' | 'zhTW' }));
vi.mock('../contexts/AppContext', () => ({ useApp: () => appState }));
afterEach(() => vi.clearAllMocks());
const article = (id: string) => ({ id, language: 'en', title: `Original ${id}`, content: 'Original content', contentHash: id }) as NewsArticle;
it('automatically translates into the site language and keeps article selections separate', async () => {
  vi.mocked(fetchArticleTranslation).mockResolvedValue({ articleId:'one', lang:'zh-TW', title:'譯文', content:'翻譯內容', autoTranslated:true } as Awaited<ReturnType<typeof fetchArticleTranslation>>);
  const { result, rerender } = renderHook(({ data }) => useTranslate(data), { initialProps: { data: article('one') } });
  await waitFor(() => expect(result.current.title).toBe('譯文'));
  expect(fetchArticleTranslation).toHaveBeenCalledWith('one', 'zh-TW');
  act(() => result.current.setSelectedLanguage('en'));
  expect(result.current.title).toBe('Original one');
  expect(fetchArticleTranslation).toHaveBeenCalledTimes(1);
  rerender({ data: article('two') });
  expect(result.current.title).toBe('Original two');
  await waitFor(() => expect(fetchArticleTranslation).toHaveBeenCalledTimes(2));
});
it('does not call the API when the site language matches the original', () => {
  appState.language = 'en';
  const { result } = renderHook(() => useTranslate(article('same')));
  expect(fetchArticleTranslation).not.toHaveBeenCalled();
  expect(result.current.title).toBe('Original same');
  appState.language = 'zhTW';
});
it('does not show a late result after navigating to another article', async () => {
  let resolve!: (value: Awaited<ReturnType<typeof fetchArticleTranslation>>) => void;
  vi.mocked(fetchArticleTranslation).mockReturnValue(new Promise(r => { resolve = r; }) as ReturnType<typeof fetchArticleTranslation>);
  const { result, rerender } = renderHook(({ data }) => useTranslate(data), { initialProps: { data: article('race') } });
  rerender({ data: article('new') });
  await act(async () => resolve({ articleId:'race', lang:'zh-TW', title:'過時譯文', autoTranslated:true, description:null, content:null, aiSummary:null, cached:false, provider:'test' }));
  expect(result.current.title).toBe('Original new');
});
