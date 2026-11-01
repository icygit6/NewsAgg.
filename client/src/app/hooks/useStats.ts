import { isEditorialKeyword } from '../lib/keywords';
import { useQuery } from '@tanstack/react-query';
import { API_BASE_URL } from '../lib/apiFetch';
import { useApp } from '../contexts/AppContext';

// Hooks over the aggregate /api/stats/* and /api/markets/* endpoints — the
// widgets read counters straight from SQL instead of downloading the whole
// article dataset.

export type SentimentEvidence = Record<'positive' | 'neutral' | 'negative', {
  count: number;
  themes: { label: string; count: number }[];
  examples: { id: string; title: string; language: string | null }[];
}>;
export interface SourceSentiments { id: string | null; name: string; domain: string | null; total: number; sentiments: { positive: number; neutral: number; negative: number } }
export interface StatsOverview {
  reportingAuthors?: { name: string; source: string; count: number; articleId: string }[];
  bySource?: SourceSentiments[];
  evidence?: SentimentEvidence;
  total: number;
  sentiments: { positive: number; neutral: number; negative: number };
  sourceCount: number;
  keywordCount: number;
  scrapedAt: string | null;
  categories: string[];
  /** Per-topic sentiment split, largest category first (overview of 'all'). */
  byCategory?: Array<{ topic: string; total: number; sentiments: { positive: number; neutral: number; negative: number }; evidence?: SentimentEvidence; bySource?: SourceSentiments[] }>;
  aiModels: Record<string, string>;
  nlpModels?: Array<{ id: string; role: string }>;
}

export interface TrendingStat {
  keyword: string;
  /** Most common original spelling, e.g. "Trump" or "AI". */
  label?: string;
  count: number;
}

export interface TrendPoint {
  day: string;
  articles: number;
  avgPolarity: number;
}

export interface MarketsSummary {
  fx: { rates?: Record<string, number>; base: 'USD'; idr: number; twd: number; eur: number; updatedAt: string | null; provider: string; fetchedAt: string; stale: boolean; unavailable: boolean };
  indices: { items: Array<{ symbol: string; name: string; close: number; changePct: number | null; spark: number[]; asOf: string | null; provider: string; exchangeTimezone: string | null }>; provider: string; fetchedAt: string; stale: boolean; unavailable: boolean };
  crypto: { items: Array<{ id: string; symbol: string; price: number; changePct24h: number | null; spark: number[]; asOf: string | null; provider: string }>; provider: string; fetchedAt: string; stale: boolean; unavailable: boolean };
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (!json?.success) throw new Error('Request failed');
  return json.data as T;
}

function useStatsScope(category: string) {
  const { selectedSources = [], selectedSentiment = 'all', searchQuery = '', selectedCategories = [], selectedSentiments = [] } = useApp();
  return new URLSearchParams({ category: category === 'all' && selectedCategories.length ? [...selectedCategories].sort().join(',') : category, sources: [...selectedSources].sort().join(','), sentiment: selectedSentiments.length ? [...selectedSentiments].sort().join(',') : selectedSentiment, q: searchQuery.trim() }).toString();
}
export function useStatsOverview(category: string = 'all') {
  const sources = useStatsScope(category);
  return useQuery({
    queryKey: ['stats', 'overview', category, sources],
    queryFn: () =>
      getJson<StatsOverview>(`/api/stats/overview?${sources}`),
  });
}

export function useTrendingStats(limit = 10, category: string = 'all') {
  const sources = useStatsScope(category);
  return useQuery({
    queryKey: ['stats', 'trending', category, limit, sources],
    select: (items: TrendingStat[]) => items.filter(item => isEditorialKeyword(item.keyword)),
    queryFn: () =>
      getJson<TrendingStat[]>(
        `/api/stats/trending?limit=${limit}&${sources}`
      ),
  });
}

export function useBusinessTrend(days = 14) {
  return useQuery({
    queryKey: ['stats', 'business-trend', days],
    queryFn: () => getJson<TrendPoint[]>(`/api/stats/business-trend?days=${days}`),
  });
}

export function useMarkets() {
  return useQuery({
    queryKey: ['markets', 'summary'],
    queryFn: () => getJson<MarketsSummary>('/api/markets/summary'),
    staleTime: 10 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });
}
