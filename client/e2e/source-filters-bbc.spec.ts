import { expect, test } from '@playwright/test';

test('source options are alphabetical after All Sources and filter icons sit above labels', async ({ page }, info) => {
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Filter', exact: true }).filter({ visible: true }).first().click();
    for (const label of ['By Category', 'By Source', 'By Sentiment', 'Sort']) {
      const tab = page.getByRole('button', { name: label, exact: true });
      await expect(tab).toBeVisible();
      const stacked = await tab.evaluate(el => {
        const icon = el.querySelector('svg')!.getBoundingClientRect();
        const text = el.querySelector('span')!.getBoundingClientRect();
        return icon.bottom <= text.top && Math.abs(icon.x + icon.width / 2 - text.x - text.width / 2) < 1;
      });
      expect(stacked, `${width}px ${label}: icon should be above its label`).toBe(true);
    }
    const sourceTab = page.getByRole('button', { name: 'By Source', exact: true });
    await sourceTab.click();
    const names = await sourceTab.evaluate(el => [...el.parentElement!.nextElementSibling!.querySelectorAll('button')].map(button => button.textContent!.trim()));
    expect(names).toEqual(['All Sources', 'Al Jazeera', 'BBC', 'CNN', 'Yahoo TW']);
    if (width === 1280) await page.screenshot({ path: `test-results/source-filter-${info.project.name}.png` });
  }
});

test('existing BBC article presentation drops publication UI and caption prefixes', async ({ page, request }) => {
  const response = await request.get('/api/news-from-db?source=bbc&pageSize=1&fields=summary');
  expect(response.ok()).toBe(true);
  const id = (await response.json()).articles[0].id;
  const details = await request.get(`/api/articles/${id}`);
  const seed = (await details.json()).data;
  await page.route('**/api/articles/bbc-label-fixture', route => route.fulfill({ json: { success: true, data: {
    ...seed, id: 'bbc-label-fixture', title: 'BBC metadata cleanup test',
    published_at: '2026-10-23T12:00:00Z',
    content: 'Published Just now\n\nPublished research found important new evidence.',
    content_blocks: [
      { type: 'paragraph', text: 'Published 2 hours ago' },
      { type: 'paragraph', text: 'Published research found important new evidence.' },
      { type: 'caption', text: 'Image caption, Players celebrate after the match.' },
    ],
    images: [{ url: 'https://example.com/secondary-photo.jpg', caption: 'Image caption, A second view of the match.', is_primary: false }],
  } } }));
  await page.goto('/article/bbc-label-fixture');
  const reading = page.locator('#article-reading-scroll');
  await expect(reading.getByText('Published research found important new evidence.', { exact: true })).toBeAttached();
  await expect(reading.getByText('Players celebrate after the match.', { exact: true })).toBeAttached();
  await expect(reading.getByText('A second view of the match.', { exact: true })).toBeAttached();
  expect(await reading.innerText()).not.toMatch(/Published (?:Just now|2 hours ago)|Image caption[,：:]/);
});
