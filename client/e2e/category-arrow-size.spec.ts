import { expect, test } from '@playwright/test';

test('category arrows match chip height for mouse and touch layouts', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  for (const [path, stripId, label] of [
    ['/', 'feed-categories', 'Next categories'],
    ['/posts', 'post-categories', 'Scroll categories right'],
  ]) {
    await page.goto(path);
    const chip = page.getByTestId(stripId).locator('button').first();
    const arrow = page.getByRole('button', { name: label, exact: true });
    await expect(chip).toBeVisible();
    await expect(arrow).toBeVisible();
    const chipBox = (await chip.boundingBox())!;
    const arrowBox = (await arrow.boundingBox())!;
    expect(Math.abs(arrowBox.height - chipBox.height)).toBeLessThan(1);
    expect(arrowBox.width).toBe(arrowBox.height);
    expect(Math.abs(arrowBox.y + arrowBox.height / 2 - chipBox.y - chipBox.height / 2)).toBeLessThan(1);
  }
});
