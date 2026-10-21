import { expect, test } from '@playwright/test';

/** Drives the posts feed through the dev stress fixtures (src/app/dev), so
 * these run with no API and no database — the data is the point, not the
 * backend. `?data=worst` is the fixture the break-ui pass was built from. */

test('worst-case data does not push the page sideways', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 });
  await page.goto('/posts?data=worst');
  await expect(page.locator('article').first()).toBeVisible();

  const overflows = await page.evaluate(() => {
    const el = document.documentElement;
    return el.scrollWidth > el.clientWidth;
  });
  expect(overflows, 'worst-case post data must not cause horizontal scroll').toBe(false);
});

test('every post keeps its avatar square and its menu reachable', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 });
  await page.goto('/posts?data=worst');
  await expect(page.locator('article').first()).toBeVisible();

  const rows = await page.locator('article').evaluateAll((articles) =>
    articles.map((article) => {
      const image = article.querySelector('img');
      const box = image?.getBoundingClientRect();
      const menu = article.querySelector<HTMLElement>('button[aria-label*="options"], button[aria-label*="Delete"], button[aria-label*="Edit"]');
      const menuBox = menu?.getBoundingClientRect();
      return {
        avatar: box ? [Math.round(box.width), Math.round(box.height)] : null,
        menuReachable: menuBox ? menuBox.right <= document.documentElement.clientWidth : null,
      };
    }),
  );

  expect(rows.length).toBeGreaterThan(3);
  for (const row of rows) {
    // A flex child without shrink-0 squashes into an oval next to a long name.
    if (row.avatar) expect(row.avatar[0]).toBe(row.avatar[1]);
    if (row.menuReachable !== null) expect(row.menuReachable).toBe(true);
  }
});

test('six-figure counts are compacted, not printed raw', async ({ page }) => {
  await page.goto('/posts?data=worst');
  await expect(page.locator('article').first()).toBeVisible();

  const labels = await page
    .locator('article button[aria-label*="@stats_bot"], article button[aria-label*="Comments"]')
    .allInnerTexts();
  const joined = labels.join(' ');
  expect(joined).not.toContain('1284903');
  await expect(page.getByText('1.3M', { exact: true })).toBeVisible();
});

test('the empty state explains itself', async ({ page }) => {
  await page.goto('/posts?data=empty');
  await expect(page.locator('article')).toHaveCount(0);
  await expect(page.getByText(/no posts yet/i)).toBeVisible();
});

test('the category strip scrolls by arrow and hides each one at its end', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/posts?data=one');

  const strip = page.getByRole('group', { name: /filter posts by category/i });
  await expect(strip).toBeVisible();
  // The scrollbar is hidden, so the arrows are the only affordance: at the
  // start there must be a right arrow and no left one.
  await expect(page.getByRole('button', { name: /scroll categories left/i })).toHaveCount(0);
  const right = page.getByRole('button', { name: /scroll categories right/i });
  await expect(right).toBeVisible();

  await strip.evaluate((el) => el.scrollTo({ left: el.scrollWidth }));
  await expect(page.getByRole('button', { name: /scroll categories left/i })).toBeVisible();
  await expect(right).toHaveCount(0);

  // And the strip must not reserve space for a scrollbar.
  const reserved = await strip.evaluate((el) => (el as HTMLElement).offsetHeight - el.clientHeight);
  expect(reserved).toBe(0);
});
