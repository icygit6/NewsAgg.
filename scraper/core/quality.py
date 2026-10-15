"""Deterministic article validation. Never invent dates or source structure."""
from __future__ import annotations
import hashlib
import re
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import urljoin, urlparse
from core.cleaner import clean_text, strip_boilerplate, date_from_url

VERSION = 'structured-v3'
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

def structured_body(soup, selectors, fallback='', extra=None):
    roots = []
    for selector in selectors:
        roots = soup.select(selector)
        if roots:
            # Yahoo appends additional stories with their own .caas-body;
            # a whole-article selector must never merge those into this story.
            if selector in ('.caas-body', '.wysiwyg', 'article'):
                roots = roots[:1]
            break
    if not roots:
        roots = soup.select('article')[:1]
    blocks, seen = [], set()
    for root in roots:
        for node in root.select('h2,h3,h4,p,ul,ol,blockquote,figcaption'):
            if any(p.name in ('ul', 'ol', 'blockquote', 'figcaption') for p in node.parents if p is not root):
                continue
            if any(NOISE.search(' '.join(p.get('class', [])) + ' ' + str(p.get('id', '')) + ' ' + str(p.get('data-block', '')) + ' ' + str(p.get('data-component', '')))
                   or p.name in ('nav', 'aside', 'footer') for p in [node, *node.parents] if getattr(p, 'attrs', None) is not None):
                continue
            text = clean_text(node.get_text(' ', strip=True))
            if node.name != 'figcaption':
                text = strip_boilerplate(text, extra)
            if not text or text in seen:
                continue
            seen.add(text)
            kind = 'heading' if node.name in ('h2', 'h3', 'h4') else 'quote' if node.name == 'blockquote' else 'caption' if node.name == 'figcaption' else 'paragraph'
            block = {'type': kind, 'text': text}
            if node.name in ('ul', 'ol'):
                items = [clean_text(n.get_text(' ', strip=True)) for n in node.find_all('li', recursive=False)]
                items = [s for s in items if s]
                # Wrapped publisher markup can contain prose but no direct li.
                # Preserve that cleaned source text rather than an invalid list.
                block = {'type': 'list', 'items': items, 'ordered': node.name == 'ol'} if items else {'type': 'paragraph', 'text': text}
            blocks.append(block)
    body = '\n\n'.join('\n'.join(b['items']) if b['type'] == 'list' else b['text'] for b in blocks)
    if len(body) < 300:
        body = strip_boilerplate(fallback, extra)
        blocks = [{'type': 'paragraph', 'text': p.strip()} for p in re.split(r'\n\s*\n', body) if p.strip()]
    return body, blocks

def content_hash(text):
    return hashlib.sha256(re.sub(r'\s+', ' ', text).strip().encode()).hexdigest()

def summary_body(blocks):
    """Keep reader captions/headings, but never treat them as summary prose."""
    return '\n\n'.join('\n'.join(b.get('items', [])) if b['type'] == 'list' else b.get('text', '')
                       for b in blocks if b['type'] in ('paragraph', 'quote', 'list'))

def image_candidates(soup, url, jsonld, top_image=None):
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
    for node in soup.select('meta[property="og:image"],meta[name="twitter:image"]'):
        add(node.get('content'))
    # Yahoo appends more articles to the same DOM. Match body extraction's
    # first-story boundary; recommendation figures are not this story's images.
    root = soup.select_one('.caas-body') or soup.select_one('.wysiwyg') or soup.select_one('article')
    for figure in root.select('figure') if root else []:
        if any(NOISE.search(' '.join(p.get('class', [])) + ' ' + str(p.get('id', '')))
               or p.name in ('aside', 'nav', 'footer') for p in [figure, *figure.parents]
               if getattr(p, 'attrs', None) is not None):
            continue
        img = figure.find('img')
        if not img:
            continue
        cap = figure.find('figcaption')
        srcset = img.get('srcset') or img.get('data-srcset')
        src = srcset.split(',')[-1].strip().split(' ')[0] if srcset else img.get('data-src') or img.get('src')
        add(src, cap.get_text(' ', strip=True)[:400] if cap else None, img.get('alt'))
    if root is None:
        add(top_image)
    return candidates[:8]

def validate_images(candidates):
    from core.http import get
    from PIL import ImageFile
    valid = []
    for candidate in candidates[:5]:
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
        except Exception:
            pass
        finally:
            response.close()
        if len(valid) >= 3:
            break
    return valid
