import type { NewsSentiment } from '../types/sentiment';

/** Mirrors scraper/core/nlp.py _classify and config.py. This reconstructs
 * the decision rule, not token attribution or a model-generated rationale. */
export function sentimentDecision(sentiment: NewsSentiment) {
  const p = sentiment.probabilities;
  const values = [p.positive, p.neutral, p.negative];
  if (sentiment.hasStoredProbabilities === false || values.some(value => !Number.isFinite(value) || value < 0 || value > 1) || values.reduce((a, b) => a + b, 0) <= 0) return null;
  const sum = values.reduce((a, b) => a + b, 0);
  const positive = p.positive / sum, neutral = p.neutral / sum, negative = p.negative / sum;
  const polarity = positive - negative;
  let label: NewsSentiment['type'];
  let rule: 'neutral-band' | 'positive-margin' | 'negative-margin' | 'highest';
  if (neutral >= 0.52 && Math.abs(polarity) <= 0.18) { label = 'neutral'; rule = 'neutral-band'; }
  else if (polarity >= 0.10) { label = 'positive'; rule = 'positive-margin'; }
  else if (polarity <= -0.10) { label = 'negative'; rule = 'negative-margin'; }
  else {
    label = positive >= neutral && positive >= negative ? 'positive' : neutral >= negative ? 'neutral' : 'negative';
    rule = 'highest';
  }
  // Older/rounded results can disagree. Never assign a made-up reason to them.
  if (label !== sentiment.type) return null;
  return { rule, polarity, positive, neutral, negative };
}
