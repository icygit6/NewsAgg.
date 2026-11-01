import { expect, test } from '@playwright/test';

for (const width of [375, 820]) {
  for (const signedIn of [false, true]) {
    test(`${signedIn ? 'signed-in' : 'guest'} profile opens from the right without a left rail at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.route('**/api/account/me', route => route.fulfill({ json: {
        success: true, user: signedIn ? { id: 99, username: 'reader', email: 'reader@example.com', emailVerified: true } : null,
      } }));
      await page.route('**/api/bookmarks/ids', route => route.fulfill({ json: { success: true, data: [] } }));
      await page.goto('/');
      const profile = page.getByRole('button', { name: 'Profile', exact: true });
      await expect(profile).toBeVisible();
      await profile.click();
      const drawer = page.getByRole('dialog');
      await expect(drawer).toBeVisible();
      await expect(drawer).toHaveCSS('right', '0px');
      await expect.poll(async () => {
        const box = (await drawer.boundingBox())!;
        return Math.abs(box.x + box.width - width);
      }).toBeLessThan(1);
      if (signedIn) await expect(drawer.getByText('reader', { exact: true })).toBeVisible();
      await expect(page).toHaveURL(/\/$/);
      await drawer.getByRole('button', { name: 'Close account panel' }).click();
      await expect(drawer).not.toBeVisible();
    });
  }
}

test('mobile news cards stay two across without horizontal overflow', async ({ page }) => {
  for (const width of [320, 390, 820]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const grid = page.locator('#main-scroll .grid.grid-cols-2').first();
    await expect(grid.locator('article').first()).toBeAttached();
    await grid.scrollIntoViewIfNeeded();
    await expect.poll(() => grid.evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(2);
    const geometry = await grid.evaluate(el => {
      const featured = el.querySelector('[data-testid="featured-story"]')!.getBoundingClientRect();
      const children = [...el.children].filter(child => !child.matches('[data-testid="featured-story"]')).slice(0, 2).map(child => child.getBoundingClientRect());
      return { overflow: el.scrollWidth - el.clientWidth, sameRow: Math.abs(children[0].y - children[1].y) < 1,
        featuredWidth: featured.width, gridWidth: el.getBoundingClientRect().width };
    });
    expect(geometry.overflow).toBeLessThanOrEqual(1);
    expect(geometry.sameRow).toBe(true);
    expect(geometry.featuredWidth).toBeCloseTo(geometry.gridWidth, 0);
  }
});

test('sentiment rails never acquire sideways scroll on feed or article pages', async ({ page, request }) => {
  const news = await request.get('/api/news-from-db?page=1&pageSize=1&fields=summary');
  test.skip(!news.ok(), 'Article API is unavailable');
  const articleId = (await news.json()).articles?.[0]?.id;
  test.skip(!articleId, 'No article available');
  for (const width of [1024, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    for (const path of ['/', '/posts', '/bookmarks', `/article/${articleId}`]) {
      await page.goto(path);
      const rail = page.locator(path.startsWith('/article/') ? '#main-scroll aside:visible' : '#rail-panel');
      await expect(rail).toBeVisible();
      if (path.startsWith('/article/')) await expect(rail.getByRole('meter')).toBeVisible();
      await expect.poll(() => rail.evaluate(el => el.scrollWidth - el.clientWidth), `${width}px ${path}`).toBeLessThanOrEqual(1);
      expect(await rail.evaluate(el => { el.scrollLeft = 100; return el.scrollLeft; })).toBe(0);
    }
  }
});
