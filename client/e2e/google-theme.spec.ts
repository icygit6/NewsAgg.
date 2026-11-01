import { expect, test } from '@playwright/test';

test('Google iframe gutters stay transparent when switching light and dark modes', async ({ page }) => {
  // Render a cross-origin Google-style iframe without authenticating or using a
  // real CAPTCHA token. Its browser color scheme is independent of button theme.
  await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js**', route => route.fulfill({
    contentType: 'application/javascript',
    body: `window.turnstile = { render(el, options) {
      setTimeout(() => options.callback('invalid-ui-test-token'), 0);
      return 'ui-test';
    }, remove() {} };`,
  }));
  await page.route('https://accounts.google.com/gsi/client**', route => route.fulfill({
    contentType: 'application/javascript',
    body: `window.google = { accounts: { id: { initialize() {}, cancel() {},
      renderButton(el, options) {
        el.replaceChildren();
        const iframe = document.createElement('iframe');
        iframe.title = 'Google sign-in fixture';
        iframe.src = 'https://accounts.google.com/gsi/button?theme=' + options.theme;
        iframe.style.cssText = 'border:0;width:' + (Number(options.width) + 20) + 'px;height:44px;margin:0 -10px;';
        el.append(iframe);
      }
    } } };`,
  }));
  await page.route('https://accounts.google.com/gsi/button?**', route => {
    const dark = new URL(route.request().url()).searchParams.get('theme') === 'filled_black';
    return route.fulfill({ contentType: 'text/html', body: `<!doctype html>
      <html style="color-scheme:light"><body style="margin:2px 10px;background:transparent">
      <button style="width:100%;height:40px;border:0;border-radius:24px;background:${dark ? '#202124' : '#fff'};color:${dark ? '#fff' : '#202124'}">Sign in with Google</button>
      </body></html>` });
  });
  await page.goto('/');
  await page.getByRole('button', { name: /^(Profile|Profile Sign In|Sign In)$/ }).filter({ visible: true }).first().click();
  const surface = page.locator('.auth-google-surface');
  for (const dark of [false, true, false, true]) {
    await page.getByRole('radio', { name: dark ? 'Dark' : 'Light', exact: true }).click();
    await expect(surface).toHaveCSS('background-color', dark ? 'rgb(32, 33, 36)' : 'rgb(255, 255, 255)');
    const iframe = surface.locator('iframe');
    await expect(iframe).toHaveAttribute('src', new RegExp(`theme=${dark ? 'filled_black' : 'outline'}$`));
    await expect(iframe).toHaveCSS('color-scheme', 'light');
    await expect(iframe).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(page.frameLocator('.auth-google-surface iframe').getByRole('button')).toBeVisible();
  }
  await surface.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `test-results/google-dark-${test.info().project.name}.png` });
});
