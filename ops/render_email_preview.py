"""Headless visual regression check for generated newsletter HTML, no mail sent."""
from pathlib import Path
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    for width, label in [(390, 'mobile'), (760, 'desktop')]:
        page = browser.new_page(viewport={'width': width, 'height': 1100}, device_scale_factor=1)
        page.goto(Path('/preview/newsletter.html').as_uri())
        assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), f'{label}: horizontal overflow'
        assert page.get_by_text('Read full story', exact=False).count() == 12
        page.screenshot(path=f'/preview/{label}.png')
        page.screenshot(path=f'/preview/{label}-full.png', full_page=True)
        page.close()
    browser.close()
print('Desktop/mobile newsletter layout checks passed')
