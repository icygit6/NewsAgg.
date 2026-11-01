import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  fetchArticlesPage,
  type ArticlesPage,
  type ArticlesPageParams,
} from '../services/newsAPI';
import type { SentimentType } from '../types/sentiment';
import { useApp } from '../contexts/AppContext';

/** Infinite paginated feed with server-side category/source/sentiment/search
 * filtering. The flat list lives in data.pages[].articles. */
export function useArticles(params: ArticlesPageParams) {
  const { selectedCategories = [], selectedSentiments = [] } = useApp();
  params = { ...params, ...(selectedCategories.length > 1 ? { category: selectedCategories.join(',') } : {}), ...(selectedSentiments.length > 1 ? { sentiment: selectedSentiments.join(',') } : {}) };
  const key = {
    category: params.category ?? 'all',
    sources: [...(params.sources ?? [])].sort(),
    sentiment: params.sentiment ?? 'all',
    q: params.q ?? '',
    sort: params.sort ?? 'latest',
    pageSize: params.pageSize ?? 20,
  };
  return useInfiniteQuery({
    queryKey: ['articles', key],
    // Preserve the loaded list when returning from an article. A fresh visit
    // or explicit refresh can obtain new publications without shifting Back.
    staleTime: 120_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    queryFn: ({ pageParam }) => fetchArticlesPage(params, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last: ArticlesPage) =>
      last.page * last.pageSize < last.totalCount ? last.page + 1 : undefined,
  });
}

/** Single page of newest articles for rail widgets (Live View / Engagement).
 * Cheap summary rows via the paginated endpoint — never the legacy store. */
export function useLatestArticles({ limit = 8, category }: { limit?: number; category?: string } = {}) {
  const { selectedSources = [], selectedSentiment = 'all', selectedSort = 'latest', searchQuery = '', selectedCategories = [], selectedSentiments = [] } = useApp();
  const params = { category: selectedCategories.length > 1 ? selectedCategories.join(',') : category, sources: [...selectedSources].sort(), sentiment: selectedSentiments.length > 1 ? selectedSentiments.join(',') : selectedSentiment, sort: selectedSort, q: searchQuery, pageSize: limit };
  return useQuery({
    queryKey: ['latest', params],
    queryFn: () => fetchArticlesPage(params, 1),
  });
}

export interface RankedHeadlinesParams {
  limit?: number;
  category?: string;
  sources?: string[];
  sentiment?: SentimentType | 'all' | '';
}

/** Single page of importance-ranked headlines (server-side `sort=rank`),
 * filter-aware: respects category/source/sentiment like the main feed. */
export function useRankedHeadlines({
  limit = 10,
  category,
  sources,
  sentiment,
}: RankedHeadlinesParams = {}) {
  const { selectedCategories = [], selectedSentiments = [] } = useApp();
  const scopeCategory = selectedCategories.length > 1 ? selectedCategories.join(',') : category;
  const scopeSentiment = selectedSentiments.length > 1 ? selectedSentiments.join(',') : sentiment;
  const key = {
    limit,
    category: scopeCategory ?? 'all',
    sources: [...(sources ?? [])].sort(),
    sentiment: scopeSentiment ?? 'all',
  };
  return useQuery({
    queryKey: ['headlines', key],
    queryFn: () =>
      fetchArticlesPage({ sort: category === 'all' || !category ? 'top' : 'rank', pageSize: limit, category: scopeCategory, sources, sentiment: scopeSentiment }, 1),
  });
}
