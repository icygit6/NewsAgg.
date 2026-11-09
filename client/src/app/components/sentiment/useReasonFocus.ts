import { useState } from 'react';
import type { SentimentType } from '../../types/sentiment';

/** The polarity picked on the pie or the reasons tabs beside it, shared so
 * the two can follow each other. Each pick is a new object, so choosing the
 * same one again still reopens it; a pick from another scope (category) is
 * dropped. */
export function useReasonFocus(scope: string) {
  const [focus, setFocus] = useState<{ type: SentimentType; scope: string }>();
  const pick = (type: SentimentType) => setFocus({ type, scope });
  return [focus?.scope === scope ? focus : undefined, pick] as const;
}
