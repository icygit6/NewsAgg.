import { useQueries } from '@tanstack/react-query';
import { useApp } from '../contexts/AppContext';
import { articleMatchesLang } from './useTranslate';
import { LANGUAGE_API_CODE } from '../services/translateService';
import { queueTitleTranslation } from '../services/titleTranslationQueue';

export function useTitleTranslations<T extends { id: string; title: string; description?: string | null; aiSummary?: string | null; language?: string | null; source?: { language?: string | null } }>(articles: T[]): T[] {
  const { language, newsMode } = useApp();
  const target = LANGUAGE_API_CODE[language];
  // Multi mode shows every headline as published; no translation requests.
  const translate = newsMode !== 'original';
  const queries = useQueries({ queries: articles.map(article => ({
    queryKey: ['article-title', article.id, article.title, target],
    queryFn: () => queueTitleTranslation(article.id, target),
    enabled: translate && !!article.id && !!article.title && !articleMatchesLang(article, target),
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  })) });
  return articles.map((article, i) => {
    const translated = queries[i]?.data;
    if (!translate || !translated || articleMatchesLang(article, target)) return article;
    return {
      ...article,
      title: translated.title ?? article.title,
      description: translated.description ?? article.description,
      aiSummary: translated.aiSummary ?? article.aiSummary,
    };
  });
}
