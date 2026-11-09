import { expect, test, type Locator } from '@playwright/test';

// The home category strip has no arrows: the edge with more chips fades out instead.
const fades = (strip: Locator) => strip.evaluate(el => {
  const style = getComputedStyle(el);
  const mask = style.maskImage && style.maskImage !== 'none' ? style.maskImage : style.webkitMaskImage;
  // Plain string checks: the browser reports the clear stop as rgba(0, 0, 0, 0) or transparent.
  const clear = ['rgba(0, 0, 0, 0)', 'transparent'];
  return {
    left: clear.some(stop => mask.startsWith(`linear-gradient(to right, ${stop} 0px`)),
    right: clear.some(stop => mask.endsWith(`${stop} 100%)`)),
  };
});

test('the category strip fades whichever edge has more chips, and none when nothing is hidden', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto('/');
  const strip = page.getByTestId('feed-categories');
  await expect(strip).toBeVisible();
  await expect.poll(() => strip.evaluate(el => el.scrollWidth - el.clientWidth)).toBeGreaterThan(40);

  await expect.poll(() => fades(strip)).toEqual({ left: false, right: true });
  await strip.evaluate(el => el.scrollTo({ left: 30, behavior: 'instant' }));
  await expect.poll(() => fades(strip)).toEqual({ left: true, right: true });
  await strip.evaluate(el => el.scrollTo({ left: el.scrollWidth, behavior: 'instant' }));
  await expect.poll(() => fades(strip)).toEqual({ left: true, right: false });

  // Wide enough for every chip: no fade at all.
  await page.setViewportSize({ width: 2560, height: 900 });
  await expect.poll(() => strip.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
  await expect.poll(() => fades(strip)).toEqual({ left: false, right: false });
});

test('category chips sit centred in one track, with only the selected chip filled', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto('/');
  const strip = page.getByTestId('feed-categories');
  const chips = strip.locator('button');
  await expect(chips.first()).toBeVisible();
  const track = (await strip.locator('..').boundingBox())!;
  for (const index of [0, 1, 2]) {
    const chip = (await chips.nth(index).boundingBox())!;
    expect(Math.abs(chip.y + chip.height / 2 - (track.y + track.height / 2))).toBeLessThan(1);
  }
  const backgrounds = await chips.evaluateAll(buttons => buttons.map(button => getComputedStyle(button).backgroundColor));
  const transparent = backgrounds.filter(colour => colour === 'rgba(0, 0, 0, 0)');
  expect(transparent).toHaveLength(backgrounds.length - 1);
  expect(await strip.locator('[aria-current="true"]').count()).toBe(1);
});
