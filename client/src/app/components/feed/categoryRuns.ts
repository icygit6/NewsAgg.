import { TOPIC_TO_CATEGORY } from '../../constants';
import type { NewsArticle } from '../../types/article';

export type FeedItem = { kind: 'card'; article: NewsArticle } | { kind: 'more'; articles: NewsArticle[] };

/** Reserve matching headlines before rendering cards. Looking only after the
 * ninth card lost the group on short pages (especially after hero deduping). */
function categoryRun(articles: NewsArticle[], offset: number, right: boolean): FeedItem[] {
  const findGroup = (pool: NewsArticle[], minimum: number) => {
    const groups = new Map<string, NewsArticle[]>();
    for (const article of pool) {
      if (!TOPIC_TO_CATEGORY[article.topic]) continue;
      const group = groups.get(article.topic) ?? [];
      group.push(article);
      groups.set(article.topic, group);
    }
    return [...groups.values()].find(group => group.length >= minimum)?.slice(0, 4);
  };
  const tail = articles.slice(4);
  const group = findGroup(tail, 3) ?? findGroup(articles, 3)
    ?? findGroup(tail, 2) ?? findGroup(articles, 2);
  if (!group) return articles.map(article => ({ kind: 'card', article }));

  const reserved = new Set(group.map(article => article.id || article.url));
  const items: FeedItem[] = articles.filter(article => !reserved.has(article.id || article.url))
    .map(article => ({ kind: 'card', article }));
  // Modulo six aligns both the two-column and three-column layouts:
  // slot 0 is leftmost in both; slot 5 is rightmost in both.
  const edge = right ? 5 : 0;
  const candidates = Array.from({ length: items.length + 1 }, (_, index) => index)
    .filter(index => (offset + index) % 6 === edge);
  let position = candidates.sort((a, b) => Math.abs(a - 6) - Math.abs(b - 6))[0];
  if (position === undefined) {
    // Short final batches may not reach the preferred edge. Keep their group
    // on an outer desktop column without adding empty grid cells.
    position = Math.min(6, items.length);
    if ((offset + position) % 3 === 1) position += position < items.length ? 1 : -1;
    if (position < 0) {
      const first = group.shift()!;
      items.push({ kind: 'card', article: first });
      position = 1;
    }
  }
  items.splice(position, 0, { kind: 'more', articles: group });
  return items;
}

/** Never regroup an earlier page when another page arrives. */
export function withCategoryRunsByPage(articles: NewsArticle[], pageOf: Map<string, number>): FeedItem[] {
  const pages = new Map<number, NewsArticle[]>();
  for (const article of articles) {
    const page = pageOf.get(article.id) ?? 0;
    const list = pages.get(page) ?? [];
    list.push(article);
    pages.set(page, list);
  }
  const result: FeedItem[] = [];
  let groups = 0;
  for (const page of [...pages.keys()].sort((a, b) => a - b)) {
    const stories = pages.get(page)!;
    // Stable batches keep the rhythm independent of a long API page.
    for (let start = 0; start < stories.length;) {
      // Fold a tiny remainder into this batch instead of producing adjacent
      // group cards with too few regular cards to reach the opposite edge.
      const size = stories.length - start < 20 ? stories.length - start : 12;
      const batch = categoryRun(stories.slice(start, start + size), result.length, groups % 2 === 1);
      start += size;
      if (batch.some(item => item.kind === 'more')) groups++;
      result.push(...batch);
    }
  }
  return result;
}
