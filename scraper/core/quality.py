"""Deterministic article validation. Never invent dates or source structure."""
from __future__ import annotations
import hashlib
import copy
import re
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import urljoin, urlparse, unquote
from core.cleaner import clean_text, clean_caption, strip_boilerplate, date_from_url

VERSION = 'structured-v3'
BODY_POLICY = 'primary-story-v4'
NOISE = re.compile(r'related|recommend|more-on|newsletter|advert|promo|social|share|footer|navigation|most-read|outbrain|taboola', re.I)
NON_ARTICLE = re.compile(r'where and how to watch|bbc sport app|download.{0,20}app|sign up for|privacy policy|terms of use', re.I)

def parse_date(value):
    if isinstance(value, datetime):
        dt = value
    elif isinstance(value, str) and value.strip():
        try:
            dt = datetime.fromisoformat(value.strip().replace('Z', '+00:00'))
        except ValueError:
            try:
                dt = parsedate_to_datetime(value)
            except (ValueError, TypeError):
                return None
    else:
        return None
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)

def publication_date(soup, jsonld, og, fallback, url, hint=None):
    candidates = [('jsonld', jsonld.get('jsonld_datePublished')), ('opengraph', og.get('published_meta'))]
    for node in soup.select('time[datetime]'):
        if 'modif' not in str(node).lower() and 'updat' not in str(node).lower():
            candidates.append(('time', node.get('datetime')))
    candidates += [('publisher-feed', hint), ('newspaper', fallback), ('url', date_from_url(url))]
    for origin, value in candidates:
        dt = parse_date(value)
        if dt:
            return dt, origin
    return None, 'unknown'

def date_rejection(dt, max_days=30, now=None):
    now = now or datetime.now(timezone.utc)
    if dt is None:
        return 'unknown_date'
    if dt > now + timedelta(hours=2):
        return 'future_date'
    if dt < now - timedelta(days=max_days):
        return 'old_article'
    return None

def article_roots(soup, selectors=()):
    """Resolve one story, never the page-wide/infinite-scroll stream."""
    article = soup.select_one('article')
    scope = article or soup
    for selector in selectors:
        roots = [article] if selector == 'article' and article is not None else scope.select(selector)
        if roots:
            return roots if selector == '[data-component="text-block"]' else roots[:1]
    for selector in ('.caas-body', 'article .atoms', '.wysiwyg', '[itemprop="articleBody"]', '.article__content', '.article__main'):
        roots = scope.select(selector)
        if roots:
            return roots[:1]
    return [article] if article is not None else []

def is_noise(node, root):
    for parent in [node, *node.parents]:
        if getattr(parent, 'attrs', None) is not None:
            attrs = ' '.join(str(parent.get(k, '')) for k in ('class', 'id', 'data-block', 'data-component', 'data-testid', 'role'))
            if NOISE.search(attrs) or parent.name in ('nav', 'aside', 'footer', 'header', 'dialog'):
                return True
            if parent.name == 'article' and parent is not root and root.name == 'article':
                return True
        if parent is root:
            break
    return False

def recommendation_text(text):
    return bool(re.match(r'^(?:更多.{0,30}(?:報導|新聞)|延伸閱讀|相關報導|相關新聞|推薦閱讀|【看原文連結】|Recommended (?:stories|articles)|Read more:|More on this story)', text, re.I))

def contamination_reason(text):
    if len(re.findall(r'[・·]\s*\d+\s*(?:分鐘|小時|天)前\s*[・·]\s*(?:發表留言|\d+則留言)', text or '')) >= 2:
        return 'recommendation_stream'
    return None

def structured_body(soup, selectors, fallback='', extra=None):
    roots = article_roots(soup, selectors)
    blocks, seen = [], set()
    for root in roots:
        for node in root.select('h2,h3,h4,p,ul,ol,blockquote,figcaption'):
            if any(p.name in ('ul', 'ol', 'blockquote', 'figcaption') for p in node.parents if p is not root):
                continue
            if is_noise(node, root):
                continue
            cleaned = copy.deepcopy(node)
            for child in list(cleaned.find_all(True)):
                if child.parent is not None and is_noise(child, cleaned):
                    child.decompose()
            text = clean_text(cleaned.get_text(' ', strip=True))
            if recommendation_text(text):
                continue
            if node.name == 'figcaption':
                text = clean_caption(text)
            else:
                text = strip_boilerplate(text, extra)
            if not text or text in seen:
                continue
            seen.add(text)
            kind = 'heading' if node.name in ('h2', 'h3', 'h4') else 'quote' if node.name == 'blockquote' else 'caption' if node.name == 'figcaption' else 'paragraph'
            block = {'type': kind, 'text': text}
            if node.name in ('ul', 'ol'):
                items = [clean_text(n.get_text(' ', strip=True)) for n in cleaned.find_all('li', recursive=False)]
                items = [s for s in items if s]
                # Wrapped publisher markup can contain prose but no direct li.
                # Preserve that cleaned source text rather than an invalid list.
                block = {'type': 'list', 'items': items, 'ordered': node.name == 'ol'} if items else {'type': 'paragraph', 'text': text}
            blocks.append(block)
    body = '\n\n'.join('\n'.join(b['items']) if b['type'] == 'list' else b['text'] for b in blocks)
    # Short scoped reporting must never be replaced by page-wide prose.
    # Known publishers fail closed when their article boundary disappears.
    if not roots and not selectors:
        body = strip_boilerplate(fallback, extra)
        blocks = [{'type': 'paragraph', 'text': p.strip()} for p in re.split(r'\n\s*\n', body) if p.strip()]
    return body, blocks

def content_hash(text):
    return hashlib.sha256(re.sub(r'\s+', ' ', text).strip().encode()).hexdigest()

def summary_body(blocks):
    """Keep reader captions/headings, but never treat them as summary prose."""
    return '\n\n'.join('\n'.join(b.get('items', [])) if b['type'] == 'list' else b.get('text', '')
                       for b in blocks if b['type'] in ('paragraph', 'quote', 'list'))

def image_candidates(soup, url, jsonld, top_image=None, selectors=()):
    candidates = []
    identities = set()
    def add(src, caption=None, alt=None):
        if not isinstance(src, str) or not src.strip():
            return
        src = urljoin(url, src.strip())
        if urlparse(src).scheme not in ('https', 'http') or re.search(r'logo|favicon|placeholder|tracking|pixel|avatar', src, re.I):
            return
        parsed = urlparse(src)
        # BBC serves the same asset under several resize paths. Preserve its
        # actual URL, but do not repeat that photo as a separate gallery image.
        identity = src
        if (parsed.hostname or '').endswith('.bbci.co.uk') and '/cpsprodpb/' in parsed.path:
            identity = 'bbc-image:' + parsed.path.split('/cpsprodpb/', 1)[1]
        if identity not in identities:
            identities.add(identity)
            candidates.append({'url': src, 'caption': caption, 'alt': alt, 'is_primary': not candidates})
    add(jsonld.get('jsonld_image'))
    metadata = soup.head or soup
    for selector in ('meta[property="og:image"]', 'meta[name="twitter:image"]'):
        node = metadata.select_one(selector)
        if node is not None:
            add(node.get('content'))
    # Yahoo appends more articles to the same DOM. Match body extraction's
    # first-story boundary; recommendation figures are not this story's images.
    roots = article_roots(soup, selectors)
    root = roots[0] if roots else None
    if root is not None and root.get('data-component') == 'text-block':
        root = root.find_parent('article') or root
    for img in root.select('img') if root else []:
        if is_noise(img, root):
            continue
        figure = img.find_parent('figure')
        cap = figure.find('figcaption') if figure else None
        srcset = img.get('srcset') or img.get('data-srcset')
        src = srcset.split(',')[-1].strip().split(' ')[0] if srcset else img.get('data-src') or img.get('src')
        add(src, clean_caption(cap.get_text(' ', strip=True))[:400] if cap else None, img.get('alt'))
    # Page-wide parser top_image may belong to a recommendation, not this story.
    return candidates[:8]

def original_yahoo_image(src):
    try:
        parsed = urlparse(src)
        if parsed.scheme != 'https' or parsed.hostname != 's.yimg.com' or not parsed.path.startswith('/lo/mysterio/api/'):
            return None
        original = unquote(parsed.path.rsplit('/', 1)[-1])
        target = urlparse(original)
        if target.scheme == 'https' and target.hostname == 'media.zenfs.com' and not target.username and not target.password and target.port is None:
            return original
    except (ValueError, TypeError):
        pass
    return None

def publisher_linked_images(soup, url, title, selectors=()):
    """Yahoo sometimes omits all photos. Follow only its explicit original-
    article link, and require a matching headline before taking OG metadata.
    This is image recovery, never another discovery or body/NLP source.
    """
    from core.cleaner import is_yahoo_tw
    from core import http, extract
    from bs4 import BeautifulSoup
    if not is_yahoo_tw(url):
        return []
    roots = article_roots(soup, selectors)
    if not roots:
        return []
    link = next((a for a in roots[0].select('a[href]') if a.get_text(strip=True) in ('【看原文連結】', '看原文連結', '原文連結')), None)
    if link is None:
        return []
    original = urljoin(url, link['href'])
    if urlparse(original).scheme != 'https' or is_yahoo_tw(original):
        return []
    response = http.get(original, timeout=8)
    if response is None:
        return []
    try:
        if 'text/html' not in response.headers.get('Content-Type', '').lower():
            return []
        publisher = BeautifulSoup(http.html_text(response), 'html.parser')
        ld = extract.jsonld_article(extract.extract_jsonld(publisher))
        og = extract.extract_og(publisher, original)
        def normalized(value):
            # Publisher title suffixes are presentation, not part of headline.
            value = re.split(r'\s+[|\-–]\s+', value or '')[0]
            return re.sub(r'\W+', '', value).casefold()
        expected = normalized(title)
        actual = normalized(ld.get('jsonld_headline') or og.get('og_title'))
        if len(expected) < 15 or actual != expected:
            return []
        # Only the matched page's primary publisher metadata, not its gallery.
        meta_soup = BeautifulSoup('', 'html.parser')
        primary = ld.get('jsonld_image') or next((i['url'] for i in og.get('images', []) if i.get('is_primary')), None)
        return [{**image, 'source_page': original, 'recovery': 'explicit-original-link-matched-headline'}
                for image in image_candidates(meta_soup, original, {'jsonld_image': primary})[:1]]
    finally:
        response.close()

def validate_images(candidates):
    from core.http import get
    from PIL import ImageFile
    valid = []
    attempts = []
    for candidate in candidates[:5]:
        attempts.append(candidate)
        original = original_yahoo_image(candidate['url'])
        if original:
            attempts.append({**candidate, 'url': original})
    verified_assets = set()
    for candidate in attempts:
        asset = original_yahoo_image(candidate['url']) or candidate['url']
        if asset in verified_assets:
            continue
        response = get(candidate['url'], timeout=8, stream=True)
        if response is None:
            continue
        try:
            if not response.headers.get('Content-Type', '').lower().startswith('image/'):
                continue
            parser = ImageFile.Parser()
            size = 0
            for chunk in response.iter_content(16384):
                parser.feed(chunk)
                size += len(chunk)
                if parser.image or size > 262144:
                    break
            if parser.image and min(parser.image.size) >= 120 and max(parser.image.size) >= 300:
                valid.append({**candidate, 'width': parser.image.size[0], 'height': parser.image.size[1], 'is_primary': not valid})
                verified_assets.add(asset)
        except Exception:
            pass
        finally:
            response.close()
        if len(valid) >= 3:
            break
    return valid
