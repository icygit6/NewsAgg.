import { expect, test } from '@playwright/test';

test('multiple category and sentiment choices remain selected and outside click dismisses filters', async ({ page }) => {
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Filter', exact: true }).filter({ visible: true }).click();
    const close = page.getByRole('button', { name: 'Close filters', exact: true }).filter({ visible: true });
    const panel = close.locator('xpath=../../..');
    await panel.getByRole('button', { name: 'Sport', exact: true }).click();
    await panel.getByRole('button', { name: 'Health', exact: true }).click();
    await expect(panel.getByRole('button', { name: 'Sport', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(panel.getByRole('button', { name: 'Health', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await panel.getByRole('button', { name: 'By Sentiment', exact: true }).click();
    await panel.getByRole('button', { name: 'Positive', exact: true }).click();
    await panel.getByRole('button', { name: 'Neutral', exact: true }).click();
    await expect(panel.getByRole('button', { name: 'Positive', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(panel.getByRole('button', { name: 'Neutral', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(close).toBeVisible();
    await page.mouse.click(width - 4, 880);
    await expect(close).toBeHidden();
    await page.getByRole('button', { name: 'Filter', exact: true }).filter({ visible: true }).click();
    await expect(panel.getByRole('button', { name: 'Positive', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Escape');
    await expect(close).toBeHidden();
  }
});
