import { expect, test } from '@playwright/test';

test('article pages show and paginate attached reader quotes with working comments', async ({ page, request }) => {
  const response = await request.get('/api/news-from-db?page=1&pageSize=1&fields=summary');
  test.skip(!response.ok(), 'Article API is unavailable');
  const articleId = (await response.json()).articles?.[0]?.id as string | undefined;
  test.skip(!articleId, 'No article is available');

  const quote = (id: number, content: string) => ({
    id, content, article_id: articleId, category: 'World', user_id: 100,
    username: 'reader', display_name: 'Reader', avatar: null, updated_at: null,
    created_at: new Date().toISOString(), article_title: 'Current article',
    article_image: null, article_topic: 'World', source_name: 'Publisher',
    like_count: 0, liked_by_me: false, comment_count: 1,
  });
  const requestedArticles: string[] = [];
  await page.route('**/api/posts?*', async route => {
    const params = new URL(route.request().url()).searchParams;
    requestedArticles.push(params.get('articleId') ?? '');
    const next = params.has('cursor');
    await route.fulfill({ json: { success: true, data: {
      posts: [quote(next ? 42 : 41, next ? 'Another reader quote' : 'A quote attached to this story')],
      nextCursor: next ? null : 'next-quote-page',
    } } });
  });
  await page.route('**/api/posts/41/comments?*', route => route.fulfill({ json: {
    success: true, data: { comments: [{ id: 1, post_id: 41, user_id: 101, parent_id: null,
      parent_username: null, content: 'A reply to this quote', created_at: new Date().toISOString(),
      username: 'another_reader', display_name: 'Another reader', avatar: null }], nextOffset: null },
  } }));

  await page.goto(`/article/${articleId}`);
  const quotes = page.getByRole('region', { name: 'Quotes about this article' });
  await quotes.scrollIntoViewIfNeeded();
  await expect(quotes.getByText('A quote attached to this story')).toBeVisible();
  await expect(quotes.getByText('Another reader quote')).toBeVisible();
  expect(requestedArticles.length).toBeGreaterThanOrEqual(2);
  expect(requestedArticles.every(value => value === articleId)).toBe(true);
  await quotes.getByRole('button', { name: 'Comments (1)' }).first().click();
  await expect(quotes.getByText('A reply to this quote')).toBeVisible();
  await expect(quotes.getByRole('link', { name: /quote/i })).toHaveAttribute('href', `/posts?compose=1&attach=${articleId}`);
});
