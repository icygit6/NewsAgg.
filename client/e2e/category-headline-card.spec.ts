import { expect, test } from '@playwright/test';

test('More in cards remain visible in outer columns on mobile and desktop, including later pages', async ({ page, request }, info) => {
  const response = await request.get('/api/news-from-db?pageSize=1&fields=summary');
  expect(response.ok()).toBe(true);
  const seed = (await response.json()).articles[0];
  const articles = Array.from({ length: 36 }, (_, index) => ({
    ...seed, id: `category-card-${index}`, url: `https://example.com/story-${index}`,
    topic: index % 3 ? 'Sport' : 'Business',
    title: `Category headline ${index + 1}: a readable story for the category card`,
  }));
  await page.route('**/api/news-from-db?*', route => {
    const params = new URL(route.request().url()).searchParams;
    const hero = params.get('sort') === 'top' || params.get('sort') === 'rank';
    const current = Number(params.get('page') || 1);
    return route.fulfill({ json: { success: true, datasetStatus: 'ok', page: current, pageSize: 20,
      totalCount: hero ? 0 : articles.length,
      articles: hero ? [] : articles.slice((current - 1) * 20, current * 20),
    } });
  });
  for (const width of [320, 390, 820, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const first = page.getByTestId('more-in-category').first();
    await expect(first).toBeAttached();
    await first.scrollIntoViewIfNeeded();
    await expect(first.getByRole('button', { name: 'See all', exact: true })).toBeVisible();
    await expect(first.getByRole('link').first()).toHaveAttribute('href', /\/article\/category-card-/);
    const main = page.locator('#main-scroll');
    await main.evaluate(el => { el.scrollTop = el.scrollHeight; });
    await expect(page.getByTestId('more-in-category')).toHaveCount(2);
    const geometry = await page.getByTestId('more-in-category').evaluateAll(cards => cards.map(card => {
      const box = card.getBoundingClientRect();
      const grid = card.parentElement!.getBoundingClientRect();
      return { edge: Math.min(Math.abs(box.left - grid.left), Math.abs(box.right - grid.right)),
        overflow: card.scrollWidth - card.clientWidth };
    }));
    for (const card of geometry) {
      expect(card.edge, `${width}px: card must be at a left or right edge`).toBeLessThan(2);
      expect(card.overflow).toBeLessThanOrEqual(1);
    }
    await expect(page.getByTestId('featured-story')).toBeAttached();
    if (width === 390) {
      await first.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `test-results/more-in-mobile-${info.project.name}.png` });
    }
  }
});
