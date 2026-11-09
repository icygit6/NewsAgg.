import type { NewsArticle } from '../../types/article';
import type { SentimentType } from '../../types/sentiment';

// ── Sentiment styling maps (shared across article sub-components) ──────────────
export const SENTIMENT_STYLE: Record<SentimentType, { label: string; badge: string }> = {
  positive: { label: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700' },
  neutral: { label: 'text-amber-700', badge: 'bg-amber-100 text-amber-800' },
  negative: { label: 'text-red-600', badge: 'bg-red-100 text-red-700' },
};

export const SENTIMENT_BAR_STYLE: Record<SentimentType, string> = {
  positive: 'bg-emerald-500',
  neutral: 'bg-amber-500',
  negative: 'bg-red-500',
};

export const SENTIMENT_CHART_COLORS: Record<SentimentType, string> = {
  positive: '#10b981',
  neutral: '#f59e0b',
  negative: '#ef4444',
};

export const sentimentTextClass: Record<SentimentType, string> = {
  positive: 'text-emerald-500',
  neutral: 'text-amber-600',
  negative: 'text-red-500',
};

export const sentimentPillClass: Record<SentimentType, string> = {
  positive: 'bg-emerald-100 text-emerald-700',
  neutral: 'bg-amber-100 text-amber-800',
  negative: 'bg-red-100 text-red-700',
};

// ── Theme helpers (centralized so every sub-component stays consistent) ────────
export const panelBaseClass = (): string =>
  'bg-white/85 border-white/60 backdrop-blur-md dark:bg-slate-800/80 dark:border-slate-700/50 dark:backdrop-blur-md';

export const mutedTextClass = (): string => ('text-slate-500 dark:text-slate-400');

export const bodyTextClass = (): string => ('text-slate-700 dark:text-slate-200');

// ── Formatters ────────────────────────────────────────────────────────────────
export const formatPublishedDate = (value: string, locale?: string, dateStyle: 'full' | 'medium' = 'full'): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(locale, { dateStyle, timeStyle: 'short' });
};

export const formatRelativeTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const diffMinutes = Math.round((Date.now() - date.getTime()) / (1000 * 60));
  if (diffMinutes <= 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.round(diffHours / 24)}d ago`;
};

export const formatCount = (value: number): string => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
};

export const formatPercent = (value?: number): string =>
  typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : 'N/A';

export const formatHost = (value: string): string => {
  try { return new URL(value).hostname.replace(/^www\./, ''); } catch { return value; }
};

export const formatAccessStatus = (article: NewsArticle): string => {
  if (article.isPremium) return 'Premium';
  if (article.isAccessibleFree === true) return 'Free access';
  if (article.isAccessibleFree === false) return 'Restricted';
  return 'Not specified by publisher';
};

export function formatCountryName(value: string | null, locale = 'en'): string {
  if (!value) return locale.startsWith('zh') ? '未提供' : 'Not provided';
  const region = value.toUpperCase() === 'UK' ? 'GB' : value.toUpperCase();
  if (!/^[A-Z]{2}$/.test(region)) return value;
  try { return new Intl.DisplayNames([locale], { type: 'region', fallback: 'none' }).of(region) || value; }
  catch { return value; }
}

export function formatLanguageName(value: string | null, locale = 'en'): string {
  if (!value) return locale.startsWith('zh') ? '未提供' : 'Not provided';
  try { return new Intl.DisplayNames([locale], { type: 'language', fallback: 'none' }).of(value.replace(/_/g, '-')) || value; }
  catch { return value; }
}
