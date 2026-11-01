import { expect, test } from '@playwright/test';

test('article columns scroll independently and keep coverage reachable', async ({ page, request }, info) => {
  const response = await request.get('/api/news-from-db?pageSize=1&source=bbc&fields=summary');
  const article = (await response.json()).articles[0];
  expect(article).toBeTruthy();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/article/${article.id}`);
  const reading = page.locator('#article-reading-scroll');
  const rail = page.getByRole('region', { name: 'Article analysis', exact: true });
  await expect(rail).toBeVisible();
  expect((await page.getByTestId('article-cover').boundingBox())!.height).toBeLessThanOrEqual(384);
  expect(await reading.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
  const railBox = (await rail.boundingBox())!;
  await page.mouse.move(railBox.x + railBox.width / 2, railBox.y + 100);
  await page.mouse.wheel(0, 450);
  await expect.poll(() => rail.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  expect(await reading.evaluate(el => el.scrollTop)).toBe(0);
  await rail.evaluate(el => { el.scrollTop = el.scrollHeight; });
  expect(await reading.evaluate(el => el.scrollTop)).toBe(0);
  await reading.getByRole('link', { name: 'Read on BBC', exact: true }).scrollIntoViewIfNeeded();
  await expect(reading.getByRole('link', { name: 'Read on BBC', exact: true })).toBeInViewport();
  const source = rail.getByText('Source and Access', { exact: true });
  await source.scrollIntoViewIfNeeded();
  await expect(rail.getByText('United Kingdom', { exact: true })).toBeVisible();
  await expect(rail.getByText('English', { exact: true })).toBeVisible();
  const trending = rail.getByRole('region', { name: 'Trending Topics', exact: true });
  await trending.scrollIntoViewIfNeeded();
  await expect.poll(() => trending.locator(':scope > div').count()).toBeGreaterThan(8);
  await trending.evaluate(el => { el.scrollTop = el.scrollHeight; });
  expect(await trending.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  await expect(trending.locator(':scope > div').last()).toBeInViewport();
  await reading.evaluate(el => { el.scrollTop = 0; });
  await rail.evaluate(el => { el.scrollTop = 0; });
  await page.screenshot({ path: `test-results/article-polish-${info.project.name}.png` });
});

test('article cover fills the reading column without becoming taller on wide desktops', async ({ page }) => {
  for (const width of [390, 820, 1280, 1536, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/article/f9d0af5379c7992b');
    const cover = page.getByTestId('article-cover');
    await expect(cover).toBeVisible();
    const img = cover.locator('img').first();
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
    const ratio = await img.evaluate((el: HTMLImageElement) => ({ actual: el.clientWidth / el.clientHeight, natural: el.naturalWidth / el.naturalHeight }));
    expect(ratio.actual).toBeCloseTo(ratio.natural, 1);
    const geometry = await cover.evaluate(el => {
      const box = el.getBoundingClientRect();
      const column = el.closest('article')!.getBoundingClientRect();
      return { width: box.width, column: column.width, height: box.height, gap: Math.abs(box.right-column.right) };
    });
    expect(geometry.width).toBeLessThanOrEqual(geometry.column);
    if (width < 1280) expect(geometry.gap).toBeLessThan(1);
  }
});

test('feed, article, posts and bookmarks fit mobile, tablet and desktop widths', async ({ page, request }, info) => {
  test.skip(info.project.name !== 'desktop', 'Responsive width sweep in one browser');
  const response = await request.get('/api/news-from-db?pageSize=1&fields=summary');
  const article = (await response.json()).articles[0];
  for (const width of [320, 390, 820, 1024, 1536, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ['/', '/posts', '/bookmarks', `/article/${article.id}`]) {
      await page.goto(path);
      await expect(page.locator('#main-scroll')).toBeVisible();
      if (path.startsWith('/article/')) await expect(page.getByTestId('article-cover')).toBeVisible();
      await expect.poll(() => page.locator('#main-scroll').evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
      if (path.startsWith('/article/')) {
        expect(await page.locator('#article-reading-scroll').evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    }
  }
});

test('donut category changes interpolate existing arcs and respect reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  const next = page.locator('#rail-panel').getByRole('button', { name: 'Next', exact: true });
  await expect(next).toBeVisible();
  const circle = page.locator('#rail-panel [data-donut-segment="Positive"]').last();
  const handle = (await circle.elementHandle())!;
  await next.click();
  const samples = await handle.evaluate(async el => {
    const values: string[] = [];
    for (let i = 0; i < 12; i++) {
      await new Promise(requestAnimationFrame);
      values.push(getComputedStyle(el).strokeDasharray);
    }
    return { connected: el.isConnected, values: [...new Set(values)] };
  });
  expect(samples.connected).toBe(true);
  expect(samples.values.length).toBeGreaterThan(3);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await next.click();
  await expect.poll(() => circle.evaluate(el => parseFloat(getComputedStyle(el).transitionDuration))).toBeLessThan(0.001);
});

test('featured center card is preserved and rounded account drawer fits the viewport', async ({ page }, info) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  const featured = page.getByTestId('featured-story');
  await expect(featured).toBeVisible();
  const cards = page.locator('#main-scroll article:not([data-testid="featured-story"]) .news-card-frame');
  await expect(cards.first()).toBeAttached();
  const widths = await cards.evaluateAll(es => es.slice(0, 3).map(e => e.getBoundingClientRect().width));
  expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(2);
  expect((await featured.boundingBox())!.width).toBeGreaterThan(widths[0] * 2);
  await page.getByRole('button', { name: /^(Profile|Profile Sign In|Sign In)$/ }).filter({ visible: true }).first().click();
  const drawer = page.getByRole('dialog');
  await expect(drawer).toBeVisible();
  expect(await drawer.evaluate(el => Math.max(parseFloat(getComputedStyle(el).borderTopLeftRadius), parseFloat(getComputedStyle(el).borderTopRightRadius)))).toBeGreaterThanOrEqual(28);
  await page.screenshot({ path: `test-results/profile-polish-${info.project.name}.png` });
});
