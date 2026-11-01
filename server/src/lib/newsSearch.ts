// Whole-term matching shared by the feed and its analytics.
export function newsSearch(text: string, params: unknown[]): string {
  return text.trim().slice(0, 200).split(/\s+/).filter(Boolean).slice(0, 12).map(term => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const latin = /^[a-z0-9_-]+$/i.test(term);
    const pattern = /^ai$/i.test(term)
      ? '\\mAI\\M|\\martificial\\s+intelligence\\M|人工智慧|人工智能'
      : latin ? `\\m${escaped}\\M` : escaped;
    params.push(pattern);
    return `(a.title ~* $${params.length} OR COALESCE(a.description, '') ~* $${params.length})`;
  }).join(' AND ') || 'TRUE';
}
