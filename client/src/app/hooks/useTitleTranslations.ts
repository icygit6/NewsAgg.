import { useQueries } from '@tanstack/react-query';
import { useApp } from '../contexts/AppContext';
import { articleMatchesLang } from './useTranslate';
import { LANGUAGE_API_CODE } from '../services/translateService';
import { queueTitleTranslation } from '../services/titleTranslationQueue';

export function useTitleTranslations<T extends { id: string; title: string; description?: string | null; aiSummary?: string | null; language?: string | null; source?: { language?: string | null } }>(articles: T[]): T[] {
  const { language } = useApp();
  const target = LANGUAGE_API_CODE[language];
  const queries = useQueries({ queries: articles.map(article => ({
    queryKey: ['article-title', article.id, article.title, target],
    queryFn: () => queueTitleTranslation(article.id, target),
    enabled: !!article.id && !!article.title && !articleMatchesLang(article, target),
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  })) });
  return articles.map((article, i) => {
    const translated = queries[i]?.data;
    if (!translated || articleMatchesLang(article, target)) return article;
    return {
      ...article,
      title: translated.title ?? article.title,
      description: translated.description ?? article.description,
      aiSummary: translated.aiSummary ?? article.aiSummary,
    };
  });
}
