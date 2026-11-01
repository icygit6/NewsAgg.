import type { SentimentType } from '../../types/sentiment';

/** Text colour for each sentiment, readable in light and dark themes. */
export const SENTIMENT_TEXT: Record<SentimentType, string> = {
  positive: 'text-emerald-600 dark:text-emerald-400',
  neutral: 'text-amber-600 dark:text-amber-400',
  negative: 'text-red-600 dark:text-red-400',
};
