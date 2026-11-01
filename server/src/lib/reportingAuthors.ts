interface AuthorArticle {
  id: string; author_name?: string | null; source_id?: string | null; source_name?: string | null;
}

/** Clean a stored byline for display without inventing anyone: drop email addresses (keeping a
 * desk credit such as "(編輯中心)"), Chinese reporter prefixes and "／台北報導"-style dateline
 * suffixes, and job titles after "｜" (e.g. "簡子喬｜Yahoo名人娛樂特派記者" → "簡子喬"). */
export function normalizeByline(raw: string | null | undefined): string {
  let name = (raw ?? '').trim().replace(/\s+/g, ' ');
  name = name.replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '').trim();
  const desk = name.match(/^\((.+)\)$|^（(.+)）$/);
  if (desk) name = (desk[1] ?? desk[2]).trim();
  name = name.split(/[｜|]/)[0].trim();
  name = name.replace(/^(?:實習)?記者\s*/, '');
  name = name.replace(/\s*[／/]\s*[^／/]*報導$/, '').trim();
  name = name.replace(/\s*(?:綜合)?報導$/, '').trim();
  return name;
}

/** Count the publisher's stored byline, once per article. Do not invent individual authors. */
export function reportingAuthors(articles: AuthorArticle[]) {
  const groups = new Map<string, { name: string; source: string; count: number; articleId: string }>();
  const seen = new Set<string>();
  for (const article of articles) {
    if (seen.has(article.id)) continue;
    seen.add(article.id);
    const name = normalizeByline(article.author_name);
    if (!name || /^(unknown|unknown author|n\/a|anonymous|未知|不詳)$/i.test(name)) continue;
    const key = JSON.stringify([article.source_id, name.toLowerCase()]);
    const existing = groups.get(key);
    if (existing) existing.count++;
    else groups.set(key, { name, source: article.source_name ?? '', count: 1, articleId: article.id });
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name) || a.source.localeCompare(b.source));
}
