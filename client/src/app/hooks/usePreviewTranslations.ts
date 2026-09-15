import { useQuery } from '@tanstack/react-query';
import { useApp } from '../contexts/AppContext';
import { fetchPreviewTranslations, LANGUAGE_API_CODE } from '../services/translateService';
import type { NewsArticle } from '../types/article';

export function usePreviewTranslations(articles: NewsArticle[]) {
  const { language, translateMode } = useApp();
  const lang = LANGUAGE_API_CODE[language];
  const ids = articles.slice(0, 20).map((article) => article.id);
  return useQuery({
    queryKey: ['preview-translations', lang, ids],
    queryFn: () => fetchPreviewTranslations(ids, lang),
    enabled: translateMode && ids.length > 0,
    staleTime: Infinity,
    retry: 1,
  });
}
