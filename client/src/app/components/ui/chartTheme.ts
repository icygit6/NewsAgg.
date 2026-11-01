/** Sentiment palette for every chart, badge and bar: green, amber, red. Neutral is amber rather
 * than grey so it reads as a position on the scale, not as missing data. These never follow the
 * colour theme: they carry meaning. */
export const SENTIMENT_COLOR = { positive: '#10b981', neutral: '#f59e0b', negative: '#ef4444' } as const;
