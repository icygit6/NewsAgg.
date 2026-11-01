import { describe, expect, it } from 'vitest';
import { withCategoryRunsByPage } from './categoryRuns';
import type { NewsArticle } from '../../types/article';

const story = (id: number, topic = 'Sport') => ({ id: String(id), url: `https://example.com/${id}`, topic }) as NewsArticle;
const ids = (items: ReturnType<typeof withCategoryRunsByPage>) => items.flatMap(item => item.kind === 'more' ? item.articles : [item.article]).map(item => item.id).sort();

describe('category headline cards', () => {
  it('keeps the card on short pages where the former ninth-slot rule omitted it', () => {
    const articles = [story(1, 'Business'), story(2), story(3), story(4)];
    const result = withCategoryRunsByPage(articles, new Map());
    expect(result.some(item => item.kind === 'more')).toBe(true);
    expect(ids(result)).toEqual(articles.map(item => item.id).sort());
  });

  it('uses two matching stories when a short page has no three-story group', () => {
    const result = withCategoryRunsByPage([story(1, 'Business'), story(2), story(3)], new Map());
    expect(result.find(item => item.kind === 'more')).toMatchObject({ articles: [story(2), story(3)] });
  });

  for (let offset = 0; offset < 12; offset++) {
    it(`never puts a group in the desktop middle column after ${offset} preceding slots`, () => {
      const first = Array.from({ length: offset }, (_, n) => story(n, 'Unknown'));
      const next = Array.from({ length: 12 }, (_, n) => story(n + 100));
      const articles = [...first, ...next];
      const pages = new Map(articles.map(item => [item.id, Number(item.topic === 'Sport')]));
      const result = withCategoryRunsByPage(articles, pages);
      const groups = result.flatMap((item, index) => item.kind === 'more' ? [index] : []);
      expect(groups).toHaveLength(1);
      expect(groups[0] % 3).not.toBe(1);
      expect(ids(result)).toEqual(articles.map(item => item.id).sort());
    });
  }

  it('does not rearrange previously displayed slots when another page loads', () => {
    const first = Array.from({ length: 13 }, (_, n) => story(n));
    const next = Array.from({ length: 10 }, (_, n) => story(n + 100, 'Climate'));
    const pages = new Map([...first.map(item => [item.id, 0] as const), ...next.map(item => [item.id, 1] as const)]);
    const before = withCategoryRunsByPage(first, pages);
    const after = withCategoryRunsByPage([...first, ...next], pages);
    expect(after.slice(0, before.length)).toEqual(before);
    expect(ids(after)).toEqual([...first, ...next].map(item => item.id).sort());
  });
});

it('repeats regular groups on alternating outer edges in two and three columns', () => {
  const articles = Array.from({ length: 72 }, (_, n) => story(n));
  const result = withCategoryRunsByPage(articles, new Map());
  const positions = result.flatMap((item, index) => item.kind === 'more' ? [index] : []);
  expect(positions).toHaveLength(6);
  positions.forEach((position, index) => {
    expect(position % 3).toBe(index % 2 ? 2 : 0);
    expect(position % 2).toBe(index % 2);
    if (index) expect(position - positions[index - 1]).toBeLessThanOrEqual(11);
  });
  expect(ids(result)).toEqual(articles.map(item => item.id).sort());
});
