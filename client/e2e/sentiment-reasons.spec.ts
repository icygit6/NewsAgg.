import { expect, test } from '@playwright/test';

for (const width of [390, 768, 1440]) {
  test(`sentiment evidence and donut interaction at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 950 });
    await page.goto(width < 1024 ? '/insights' : '/');
    const reasons = page.locator('[data-testid="sentiment-reasons"]:visible').first();
    await expect(reasons.getByText('Pattern summary')).toBeVisible({ timeout: 30000 });
    const group = page.locator('[role="group"][aria-label*="Positive:"]:visible').first();
    const segment = group.getByRole('button').first();
    await segment.focus();
    await expect(segment).toHaveAttribute('aria-pressed', 'true');
    await segment.press('Escape');
    await expect(segment).toHaveAttribute('aria-pressed', 'false');
    // Pointer/tap behaviour uses the same activation path as a segment click.
    await segment.press('Enter');
    await expect(segment).toHaveAttribute('aria-pressed', 'true');
    await reasons.locator('summary').click();
    await expect(reasons.locator('details')).toHaveAttribute('open', '');
    await expect(reasons.getByRole('heading', { name: /Negative/ })).toBeVisible();
    const link = reasons.getByRole('link').first();
    await expect(link).toHaveAttribute('href', /^\/article\//);
    expect(await reasons.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await reasons.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `../logs/ui-preview/sentiment-reasons-${width}.png` });
    const href = await link.getAttribute('href');
    await link.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await expect(page.locator('[data-testid="sentiment-reasons"]:visible').first()).toBeVisible({ timeout: 30000 });
  });
}

test('evidence totals and examples follow source, category and sentiment filters', async ({ request }) => {
  const response = await request.get('/api/stats/overview?category=sport,health&sources=bbc&sentiment=negative');
  expect(response.ok()).toBe(true);
  const { data } = await response.json();
  expect(data.total).toBeGreaterThan(0);
  for (const scope of [data, ...data.byCategory]) {
    for (const type of ['positive', 'neutral', 'negative']) {
      expect(scope.evidence[type].count).toBe(scope.sentiments[type]);
      expect(scope.evidence[type].examples.length).toBeLessThanOrEqual(2);
    }
    expect(scope.sentiments.positive).toBe(0);
    expect(scope.sentiments.neutral).toBe(0);
  }
  expect(data.byCategory.every((row: { topic: string }) => ['Sport', 'Health'].includes(row.topic))).toBe(true);
});
