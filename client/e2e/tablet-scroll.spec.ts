import { expect, test } from '@playwright/test';

for (const width of [1024, 1366]) {
  test(`desktop layout remains touch-scrollable at ${width}px tablet width`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Chromium CDP touch gesture test');
    await page.setViewportSize({ width, height: 768 });
    await page.goto('/');
    const main = page.locator('#main-scroll');
    await expect(main).toBeVisible();
    await expect.poll(() => main.evaluate(el => el.scrollHeight - el.clientHeight)).toBeGreaterThan(100);

    const box = (await main.boundingBox())!;
    const x = box.x + box.width / 2;
    const startY = box.y + Math.min(box.height - 40, 560);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: startY }] });
    for (let step = 1; step <= 6; step++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: startY - step * 45 }] });
      await page.waitForTimeout(16);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => main.evaluate(el => el.scrollTop)).toBeGreaterThan(30);
  });
}

test('mouse wheel moves the category strip smoothly without shifting it', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });

  for (const { path, stripId } of [
    { path: '/', stripId: 'feed-categories' },
  ]) {
    await page.goto(path);
    const strip = page.getByTestId(stripId);
    await expect(strip).toBeVisible();
    // No arrows: the strip only needs more chips than fit.
    await expect.poll(() => strip.evaluate(el => el.scrollWidth - el.clientWidth)).toBeGreaterThan(40);
    const stripBox = (await strip.boundingBox())!;

    await page.mouse.move(stripBox.x + stripBox.width / 2, stripBox.y + stripBox.height / 2);
    await strip.evaluate(el => {
      const positions: number[] = [];
      (el as HTMLElement & { wheelSamples: number[] }).wheelSamples = positions;
      (el as HTMLElement & { wheelDelta: number }).wheelDelta = 0;
      el.addEventListener('wheel', event => {
        (el as HTMLElement & { wheelDelta: number }).wheelDelta += (event as WheelEvent).deltaY;
      }, { passive: true });
      const record = () => {
        positions.push(el.scrollLeft);
        if (positions.length < 60) requestAnimationFrame(record);
      };
      requestAnimationFrame(record);
    });
    await page.mouse.wheel(0, 220);
    // Mobile-emulated Chromium scales the input delta by its device scale.
    // Verify the DOM event's CSS-pixel distance, not the automation input units.
    await expect.poll(() => strip.evaluate(el => Math.abs(el.scrollLeft - Math.min(
      el.scrollWidth - el.clientWidth, (el as HTMLElement & { wheelDelta: number }).wheelDelta,
    )))).toBeLessThan(1);
    // Count positions strictly between the start and where the scroll ends: mobile-emulated
    // Chromium scales the step (~2.6x), so a fixed 219px ceiling saw its first frame jump past it.
    const intermediate = await strip.evaluate(el => (el as HTMLElement & { wheelSamples: number[] }).wheelSamples.filter(position => position > 0 && position < el.scrollLeft - 0.5));
    expect(new Set(intermediate).size, `${path}: wheel movement must animate through intermediate positions`).toBeGreaterThan(3);
    // Scrolling must not move or resize the strip (no arrow lanes opening up).
    const movedStripBox = (await strip.boundingBox())!;
    expect(movedStripBox.width).toBeCloseTo(stripBox.width, 0);
    expect(movedStripBox.x).toBeCloseTo(stripBox.x, 0);

    // A rapid burst must accumulate rather than restarting smooth scrolling.
    await strip.evaluate(el => el.scrollTo({ left: 0, behavior: 'instant' }));
    await strip.evaluate(el => { (el as HTMLElement & { wheelDelta: number }).wheelDelta = 0; });
    await page.mouse.wheel(0, 60);
    await page.mouse.wheel(0, 60);
    await page.mouse.wheel(0, 60);
    await expect.poll(() => strip.evaluate(el => Math.abs(el.scrollLeft - Math.min(
      el.scrollWidth - el.clientWidth, (el as HTMLElement & { wheelDelta: number }).wheelDelta,
    )))).toBeLessThan(1);

    // Keyboard focus reveals a chip without changing the selected category.
    const selected = await strip.locator('[aria-current="true"], [aria-pressed="true"]').innerText();
    await strip.locator('button').first().focus();
    await page.keyboard.press('End');
    await expect(strip.locator('button').last()).toBeFocused();
    await expect.poll(() => strip.evaluate(el => el.scrollWidth - el.clientWidth - el.scrollLeft)).toBeLessThan(10);
    expect(await strip.locator('[aria-current="true"], [aria-pressed="true"]').innerText()).toBe(selected);
  }
});

test('desktop home keeps three news columns at tablet and full desktop widths', async ({ page }) => {
  for (const width of [1024, 1280, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const grid = page.locator('#main-scroll .lg\\:grid-cols-3').first();
    await expect(grid).toBeVisible();
    await expect.poll(() => grid.evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length), `${width}px desktop feed`).toBe(3);
  }
});

test('category wheel scrolling respects reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const strip = page.getByTestId('feed-categories');
  await expect.poll(() => strip.evaluate(el => el.scrollWidth - el.clientWidth)).toBeGreaterThan(160);
  const position = await strip.evaluate(el => {
    el.dispatchEvent(new WheelEvent('wheel', { deltaY: 160, bubbles: true, cancelable: true }));
    return el.scrollLeft;
  });
  expect(position).toBe(160);
});

test('category touch swipes scroll sideways without selecting a chip', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Chromium CDP touch gesture test');
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto('/');
  const strip = page.getByTestId('feed-categories');
  await expect(strip).toBeVisible();
  await expect.poll(() => strip.evaluate(el => el.scrollWidth - el.clientWidth)).toBeGreaterThan(40);
  const selected = await strip.locator('[aria-current="true"]').innerText();
  const box = (await strip.boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  const x = box.x + box.width - 20;
  const y = box.y + box.height / 2;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let step = 1; step <= 6; step++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - step * 35, y }] });
    await page.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(() => strip.evaluate(el => el.scrollLeft)).toBeGreaterThan(30);
  expect(await strip.locator('[aria-current="true"]').innerText()).toBe(selected);
});
