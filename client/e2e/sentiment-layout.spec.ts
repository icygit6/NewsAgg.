import { expect, test } from '@playwright/test';

// 1920px display at 100%, 125%, and 150% Windows scaling corresponds to
// roughly 1920, 1536, and 1280 CSS pixels. Include a narrower desktop too.
for (const width of [1920, 1536, 1280, 1100]) {
  test(`news and sentiment keep a 60:40 split at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });

    for (const path of ['/', '/posts', '/bookmarks']) {
      await page.goto(path);
      await expect(page.locator('#main-scroll')).toBeVisible();
      await expect(page.locator('#rail-panel')).toBeVisible();
      const widths = await page.evaluate(() => {
        const main = document.querySelector<HTMLElement>('#main-scroll');
        const rail = document.querySelector<HTMLElement>('#rail-panel')?.parentElement;
        return { main: main?.getBoundingClientRect().width, rail: rail?.getBoundingClientRect().width };
      });

      expect(widths.main, `${path}: main column`).toBeGreaterThan(0);
      expect(widths.rail, `${path}: sentiment column`).toBeGreaterThan(0);
      expect(widths.main! / (widths.main! + widths.rail!), `${path}: main share`).toBeCloseTo(0.6, 2);
      expect(widths.rail! / (widths.main! + widths.rail!), `${path}: sentiment share`).toBeCloseTo(0.4, 2);
    }
  });
}

test('article sentiment panel uses the same split at display-scaled widths', async ({ page, request }) => {
  const response = await request.get('/api/news-from-db?page=1&pageSize=1&fields=summary');
  test.skip(!response.ok(), 'Article API is unavailable in this environment');
  const articleId = ((await response.json()) as { articles?: { id?: string }[] }).articles?.[0]?.id;
  test.skip(!articleId, 'No article is available in this environment');

  for (const width of [1920, 1536, 1280, 1100]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/article/${articleId}`);
    const layout = page.getByTestId('article-sentiment-layout');
    await expect(layout).toBeVisible();
    const widths = await layout.evaluate((element) => {
      const [main, rail] = element.children;
      return { main: main.getBoundingClientRect().width, rail: rail.getBoundingClientRect().width };
    });
    expect(widths.main / (widths.main + widths.rail), `${width}px: article share`).toBeCloseTo(0.6, 2);
    expect(widths.rail / (widths.main + widths.rail), `${width}px: sentiment share`).toBeCloseTo(0.4, 2);
  }
});
