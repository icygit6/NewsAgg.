import { expect, test } from '@playwright/test';

/** The news filter panel: one trigger, two presentations. */

test('on a phone the panel drops down from the filter button', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');

  const trigger = page.getByRole('button', { name: /filter/i }).first();
  await trigger.click();

  const panel = page.getByText('Filters').first();
  await expect(panel).toBeVisible();

  const triggerBox = (await trigger.boundingBox())!;
  const panelBox = (await panel.boundingBox())!;
  // It belongs to the button at the top of the screen, so it opens below it —
  // not as a sheet rising from the bottom edge.
  expect(panelBox.y).toBeGreaterThanOrEqual(triggerBox.y);
  expect(panelBox.y).toBeLessThan(400);
});

test('the filter tabs stay inside their pills at phone width', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await page.getByRole('button', { name: /filter/i }).first().click();

  const overflow = await page
    .getByRole('button', { name: /by category/i })
    .first()
    .evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(overflow, 'the icon and label must fit inside the tab').toBeLessThanOrEqual(1);
});

test('choosing a category closes the loop back to the chip strip', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');

  await page.getByRole('button', { name: /filter/i }).first().click();
  await page.getByRole('button', { name: 'Sport', exact: true }).first().click();

  const active = page.locator('[aria-current="true"]');
  await expect(active).toHaveText(/sport/i);
});
