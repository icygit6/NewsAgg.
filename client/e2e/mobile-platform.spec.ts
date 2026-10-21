import { expect, test } from '@playwright/test';

/** Guards the platform-layer fixes that have no visible component to assert
 * against — the kind that silently regress when someone edits index.html or
 * the base layer. Each one is a real iOS/Android behaviour, not a style. */
test.describe('mobile platform layer', () => {
  test('viewport opts into the safe area and the keyboard resize', async ({ page }) => {
    await page.goto('/');
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    // Without viewport-fit=cover every env(safe-area-inset-*) in the app is 0px,
    // which silently un-pads the bottom tab bar and the filter sheet.
    expect(viewport).toContain('viewport-fit=cover');
    expect(viewport).toContain('interactive-widget=resizes-content');
    expect(viewport).not.toContain('user-scalable=no');
    expect(viewport).not.toContain('maximum-scale');
  });

  test('the status bar has a colour per scheme', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('meta[name="theme-color"][media*="light"]')).toHaveCount(1);
    await expect(page.locator('meta[name="theme-color"][media*="dark"]')).toHaveCount(1);
    await expect(page.locator('meta[name="color-scheme"]')).toHaveCount(1);
  });

  test('the page does not pull-to-refresh or rubber-band', async ({ page }) => {
    await page.goto('/');
    for (const selector of ['html', 'body']) {
      const behaviour = await page
        .locator(selector)
        .evaluate((el) => getComputedStyle(el).overscrollBehavior);
      expect(behaviour).toBe('none');
    }
  });

  test('controls do not wait for a double tap or select their own label', async ({ page }) => {
    await page.goto('/');
    const button = page.locator('button').first();
    await expect(button).toHaveCSS('touch-action', 'manipulation');
    await expect(button).toHaveCSS('user-select', 'none');
  });
});

test.describe('input zoom', () => {
  test('inputs are at least 16px on a touch pointer', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'the rule is gated on (pointer: coarse)');
    await page.goto('/');
    const size = await page
      .locator('input[type="search"]')
      .first()
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    // Under 16px, iOS Safari zooms the page on focus and never zooms back out.
    expect(size).toBeGreaterThanOrEqual(16);
  });

  test('the designed 14px survives on a mouse pointer', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop keeps the smaller type');
    await page.goto('/');
    const size = await page
      .locator('input[type="search"]')
      .first()
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(size).toBeLessThan(16);
  });
});
