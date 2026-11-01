interface SourceArticle {
  source_id: string | null;
  source_name: string | null;
  source_domain: string | null;
  sentiment_type: string;
}

/** Rows already belong to the overview's filtered, repeatable-read snapshot. */
export function sourceSentiments(rows: SourceArticle[]) {
  const sources = new Map<string, { id: string | null; name: string; domain: string | null; total: number; sentiments: { positive: number; neutral: number; negative: number } }>();
  for (const row of rows) {
    const key = row.source_id ?? 'unknown';
    const source = sources.get(key) ?? { id: row.source_id, name: row.source_name || 'Unknown source', domain: row.source_domain, total: 0, sentiments: { positive: 0, neutral: 0, negative: 0 } };
    source.total++;
    const type = row.sentiment_type;
    if (type === 'positive' || type === 'neutral' || type === 'negative') source.sentiments[type]++;
    sources.set(key, source);
  }
  return [...sources.values()].sort((a, b) => a.name.localeCompare(b.name));
}
