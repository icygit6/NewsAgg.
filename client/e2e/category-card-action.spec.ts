import { expect, test } from '@playwright/test';

test('More in action disappears after entering the corresponding category', async ({ page }) => {
  await page.goto('/');
  const card = page.getByTestId('more-in-category').first();
  await expect(card).toBeAttached();
  const label = await card.getAttribute('aria-label');
  const category = label!.replace(/^More in /, '');
  const action = card.getByRole('button', { name: 'See all', exact: true });
  await action.scrollIntoViewIfNeeded();
  await action.click();
  await expect(page.locator('#main-scroll').getByRole('heading', { name: category, exact: true })).toBeVisible();
  const selectedCard = page.getByRole('region', { name: label!, exact: true }).first();
  await expect(selectedCard).toBeAttached();
  await expect(selectedCard.getByRole('button', { name: 'See all', exact: true })).toHaveCount(0);
  expect(await selectedCard.getByRole('link').count()).toBeGreaterThan(0);
});
