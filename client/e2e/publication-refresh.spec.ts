import { expect, test } from '@playwright/test';

test('refreshes published data on revision changes without repeatedly fetching unchanged aggregates', async ({ page }) => {
  await page.clock.install();
  let revision = 'test-1';
  let checks = 0;
  let aggregates = 0;
  // Simulate a publication notification without modifying real articles.
  await page.route('**/api/stats/revision', route => {
    checks++;
    return route.fulfill({ json: { success: true, data: { revision } } });
  });
  page.on('request', request => { if (request.url().includes('/api/stats/overview?')) aggregates++; });
  await page.goto('/insights');
  await expect(page.locator('[data-testid="sentiment-reasons"]:visible').first()).toBeVisible({ timeout: 30000 });
  await expect.poll(() => checks).toBeGreaterThan(0);
  const initial = aggregates;
  await page.clock.fastForward(30000);
  await expect.poll(() => checks).toBeGreaterThan(1);
  expect(aggregates).toBe(initial);
  revision = 'test-2';
  await page.clock.fastForward(30000);
  await expect.poll(() => aggregates).toBeGreaterThan(initial);
});
