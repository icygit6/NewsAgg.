"""Headless visual regression check for generated newsletter HTML, no mail sent."""
from pathlib import Path
import sys
from playwright.sync_api import sync_playwright

preview = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('/preview')
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    for width, label in [(390, 'mobile'), (760, 'desktop')]:
        page = browser.new_page(viewport={'width': width, 'height': 1100}, device_scale_factor=1)
        page.goto((preview / 'newsletter.html').resolve().as_uri())
        assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), f'{label}: horizontal overflow'
        assert page.locator('a.story-link').count() == 12
        assert page.get_by_text('TODAY AT A GLANCE／今日概覽', exact=True).count() == 1
        page.screenshot(path=str(preview / f'{label}.png'))
        page.screenshot(path=str(preview / f'{label}-full.png'), full_page=True)
        page.close()
    browser.close()
print('Desktop/mobile newsletter layout checks passed')
