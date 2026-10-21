import { expect, test } from '@playwright/test';

/** Chrome-level journeys. Asserts on navigation and layout rather than on
 * article content, so the suite stays green when no scraper has run. */

const DESTINATIONS = [
  { name: /posts/i, path: '/posts' },
  { name: /insights/i, path: '/insights' },
  { name: /bookmarks/i, path: '/bookmarks' },
];

for (const { name, path } of DESTINATIONS) {
  test(`the nav reaches ${path}`, async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name, exact: false }).first().click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
  });
}

test('signed out, the profile tab opens the auth drawer', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /profile|sign in/i }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByLabel('Email')).toBeVisible();
});

test('signed out, there is no admin entry point', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: /^admin$/i })).toHaveCount(0);
});

test('the admin page refuses a signed-out visitor', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.getByText(/sign in as an admin/i)).toBeVisible();
});
