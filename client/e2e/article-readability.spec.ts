import { expect, test } from '@playwright/test';

test('article category distribution precedes readability, which is hidden for Yahoo Taiwan', async ({ page, request }) => {
  for (const source of ['bbc', 'yahoo_tw']) {
    const response = await request.get(`/api/news-from-db?page=1&pageSize=1&fields=summary&source=${source}`);
    expect(response.ok()).toBe(true);
    const article = (await response.json()).articles[0];
    expect(article).toBeTruthy();
    await page.goto(`/article/${article.id}`);
    const category = page.getByText('Category Sentiment Distribution', { exact: true }).filter({ visible: true });
    await expect(category).toBeVisible();
    const readability = page.getByText('Readability', { exact: true });
    if (source === 'yahoo_tw') {
      await expect(readability).toHaveCount(0);
    } else {
      await expect(readability.first()).toBeAttached();
      expect(await category.evaluate((el) => {
        const heading = [...el.parentElement!.parentElement!.querySelectorAll('h2,h3,h4')].find(node => node.textContent === 'Readability');
        return Boolean(heading && (el.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING));
      })).toBe(true);
    }
  }
});
