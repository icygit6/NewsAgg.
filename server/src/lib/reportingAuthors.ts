interface AuthorArticle {
  id: string; author_name?: string | null; source_id?: string | null; source_name?: string | null;
}
/** Count the publisher's stored byline, once per article. Do not invent individual authors. */
export function reportingAuthors(articles: AuthorArticle[]) {
  const groups = new Map<string, { name: string; source: string; count: number; articleId: string }>();
  const seen = new Set<string>();
  for (const article of articles) {
    if (seen.has(article.id)) continue;
    seen.add(article.id);
    const name = article.author_name?.trim().replace(/\s+/g, ' ');
    if (!name || /^(unknown|unknown author|n\/a|anonymous|未知|不詳)$/i.test(name)) continue;
    const key = JSON.stringify([article.source_id, name.toLowerCase()]);
    const existing = groups.get(key);
    if (existing) existing.count++;
    else groups.set(key, { name, source: article.source_name ?? '', count: 1, articleId: article.id });
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name) || a.source.localeCompare(b.source));
}
