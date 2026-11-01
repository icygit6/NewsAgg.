export type SentimentType = 'positive' | 'neutral' | 'negative';

export interface NewsSentimentProbabilities {
  positive: number;
  neutral: number;
  negative: number;
}

export interface NewsSentiment {
  hasStoredProbabilities?: boolean;
  type: SentimentType;
  score: number;
  comparative: number;
  probabilities: NewsSentimentProbabilities;
  model: string;
}

export interface SentimentDistributionItem {
  type: SentimentType;
  count: number;
}
