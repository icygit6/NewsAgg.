"""Rate-limited HTTP: shared session, candidate crawling, optional JS render.

``crawl_source`` discovers candidate article links from a section/index page.
``fetch_rendered_html`` uses Playwright for JS-heavy sources (Yahoo TW); it is
imported lazily so the dependency is only needed when actually scraping Yahoo.
"""
from __future__ import annotations

import logging
import time
import ipaddress
import socket
from urllib.parse import urlparse
from typing import Optional

import requests
from bs4 import BeautifulSoup, UnicodeDammit

from core import config
from core.cleaner import JUNK, dom, is_article_url, make_abs, same_family

_log = logging.getLogger(__name__)

_SESSION = requests.Session()
_SESSION.headers.update({"User-Agent": config.USER_AGENT})

def public_url(url):
    """Reject internal/file URLs, including private redirect destinations."""
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ('http', 'https') or parsed.username or parsed.password or parsed.port not in (None, 80, 443):
            return False
        addresses = socket.getaddrinfo(parsed.hostname, parsed.port or 443)
        return bool(addresses) and all(ipaddress.ip_address(a[4][0]).is_global for a in addresses)
    except (ValueError, OSError, TypeError):
        return False


def get(url: str, timeout: int = config.REQUEST_TIMEOUT, *, stream=False) -> Optional[requests.Response]:
    """GET with per-domain rate limiting. Returns None on any failure."""
    rl = config.RATE_LIMIT  # domain -> next-allowed timestamp
    domain = dom(url)
    wait = rl[domain] - time.time()
    if wait > 0:
        time.sleep(wait)
    try:
        for _ in range(5):
            if not public_url(url):
                return None
            r = _SESSION.get(url, timeout=timeout, stream=stream, allow_redirects=False)
            if r.is_redirect:
                from urllib.parse import urljoin
                url = urljoin(url, r.headers.get('Location', ''))
                r.close()
                continue
            break
        else:
            return None
        rl[domain] = time.time() + config.RATE_DELAY
        r.raise_for_status()
        return r
    except Exception as e:                       # noqa: BLE001 - log + continue
        _log.debug("GET failed %s: %s", url, e)
        return None


def html_text(response):
    # requests defaults text/html without charset to Latin-1, even when the
    # publisher's HTML declares UTF-8. Decode the bytes using that declaration.
    declared = response.encoding if 'charset=' in response.headers.get('Content-Type', '').lower() else None
    return UnicodeDammit(response.content, known_definite_encodings=[declared] if declared else [], is_html=True).unicode_markup or ''


def fetch_soup(url: str, timeout: int = config.REQUEST_TIMEOUT) -> Optional[BeautifulSoup]:
    r = get(url, timeout=timeout)
    if not r:
        return None
    return BeautifulSoup(html_text(r), "html.parser")


def fetch_rendered_html(url: str, timeout: int = 30) -> Optional[str]:
    """Render a JS page with Playwright and return its HTML (lazy import).

    Used for Yahoo TW, which renders article lists/content client-side.
    Returns None if Playwright is unavailable or rendering fails.
    """
    try:
        from playwright.sync_api import sync_playwright
    except Exception as e:                       # noqa: BLE001
        _log.warning("Playwright unavailable (%s); JS render skipped for %s", e, url)
        return None
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(user_agent=config.USER_AGENT)
            verified = {}
            def route_request(route):
                request = route.request
                if request.resource_type in ('image', 'media', 'font'):
                    return route.abort()
                parsed = urlparse(request.url)
                origin = (parsed.scheme, parsed.netloc)
                if origin not in verified:
                    verified[origin] = public_url(request.url)
                return route.continue_() if verified[origin] else route.abort()
            page.route('**/*', route_request)
            page.goto(url, wait_until="domcontentloaded", timeout=timeout * 1000)
            page.wait_for_timeout(1500)          # let lazy content settle
            html = page.content()
            page.unroute_all(behavior='wait')
            browser.close()
            return html
    except Exception as e:                        # noqa: BLE001
        _log.warning("Playwright render failed for %s: %s", url, e)
        return None


def crawl_source(source_url: str, category: str, max_cand: int,
                 *, rendered: bool = False) -> list[dict]:
    """Collect candidate {url, topic, title_hint} dicts from one index page."""
    results: list[dict] = []
    seen: set[str] = set()
    print(f"  search {source_url}")

    if rendered:
        html = fetch_rendered_html(source_url)
        soup = BeautifulSoup(html, "html.parser") if html else None
    else:
        soup = fetch_soup(source_url)

    if soup is None:
        print("     failed")
        return []

    root = soup.find('main') or soup
    for tag in root.find_all("a", href=True):
        if tag.find_parent(['nav', 'footer', 'header', 'aside']):
            continue
        url = make_abs(tag["href"], source_url)
        if not same_family(url, source_url) or not is_article_url(url) or url in seen:
            continue
        hint = tag.get("aria-label", "").strip()
        if not hint:
            for tn in ("h1", "h2", "h3", "h4", "span", "p"):
                el = tag.find(tn)
                if el:
                    cand = el.get_text(strip=True)
                    if len(cand) >= 20 and not JUNK.search(cand):
                        hint = cand
                        break
        if not hint:
            raw = tag.get_text(strip=True)
            if len(raw) >= 20 and not JUNK.search(raw):
                hint = raw
        if not hint:
            continue
        seen.add(url)
        results.append({"url": url, "topic": category, "title_hint": hint, "source_url": source_url})
        if len(results) >= max_cand:
            break

    print(f"     -> {len(results)} candidates")
    return results

def crawl_feed(feed_url, category, max_cand, source_url):
    """RSS/Atom is preferred for dated discovery; publication is verified again on-page."""
    import xml.etree.ElementTree as ET
    response = get(feed_url)
    if response is None:
        return []
    try:
        root = ET.fromstring(response.content)
    except ET.ParseError:
        return []
    rows = []
    for item in root.findall('.//item') + root.findall('.//{http://www.w3.org/2005/Atom}entry'):
        values = {n.tag.split('}')[-1]: (n.text or '').strip() for n in item}
        link = values.get('link') or next((n.get('href') for n in item if n.tag.endswith('link')), '')
        url = make_abs(link, source_url)
        if same_family(url, source_url) and is_article_url(url):
            rows.append({'url': url, 'topic': category, 'title_hint': values.get('title', ''), 'published_hint': values.get('pubDate') or values.get('published'), 'source_url': feed_url})
        if len(rows) >= max_cand:
            break
    return rows
