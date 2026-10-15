"""Enrichment + per-source orchestration (crawl -> filter -> enrich -> store).

``enrich_article`` turns one candidate into a full DB-ready record.
``run_source`` drives a SourceSpec end to end and upserts into the live DB.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

from bs4 import BeautifulSoup

from core import config, db, extract, http, nlp, summarizer, quality
from core.cleaner import (
    clean_text,
    date_from_url,
    is_fresh,
    normalize_canonical,
    source_meta,
    strip_boilerplate,
    truncate_content,
    url_id,
)


@dataclass
class SourceSpec:
    """Describes one news source for the pipeline."""
    key: str                              # "cnn"
    name: str                             # "CNN"
    categories: dict[str, list[str]]      # English Title-case topic -> [index URLs]
    language: str = "en"
    use_playwright: bool = False          # render index + article with Playwright
    skip_zero_shot: bool = False          # trust section->topic mapping (Yahoo)
    target_per_category: int = field(default=config.TARGET_PER_CATEGORY)
    content_selectors: list[str] = field(default_factory=list)   # CSS selectors tried first for the body
    boilerplate_extra: list[re.Pattern] = field(default_factory=list)  # site-specific line filters
    feeds: dict[str, list[str]] = field(default_factory=dict)


# ═══════════════════════════════════════════════════════════════════
# Body extraction (trafilatura-first, boilerplate-aware)
# ═══════════════════════════════════════════════════════════════════
def _lead_sentences(text: str, limit: int = 220) -> str:
    """First 1-2 sentences of the clean body — used as the description
    fallback instead of a blind text[:300] cut. CJK-aware split."""
    if not text:
        return ""
    parts = re.split(r"(?<=[。！？])|(?<=[.!?])\s+", text.replace("\n", " "))
    out = ""
    for p in parts:
        p = p.strip()
        if not p:
            continue
        if out and len(out) + len(p) + 1 > limit:
            break
        out = f"{out} {p}".strip()
        if len(out) >= limit:
            break
    return out or text[:limit]


def _extract_body(art, page_html: Optional[str], spec: SourceSpec, soup) -> str:
    """Best clean body we can get, in order of precision:
    1. source-specific CSS selectors (e.g. Yahoo TW ``.caas-body``),
    2. trafilatura on the page HTML (DOM-aware boilerplate removal),
    3. newspaper3k's text (legacy behavior — concatenates everything).
    newspaper3k stays the source of title/authors/top_image/publish_date."""
    np_text = clean_text(art.text or "")

    for sel in spec.content_selectors:
        try:
            nodes = soup.select(sel)
        except Exception:
            nodes = []
        if nodes:
            text = clean_text("\n\n".join(n.get_text("\n", strip=True) for n in nodes))
            if len(text) >= max(config.MIN_TEXT_LEN, int(len(np_text) * 0.5)):
                return text

    if page_html:
        try:
            import trafilatura
            t = trafilatura.extract(
                page_html,
                favor_precision=True,
                include_comments=False,
                include_tables=False,
            )
            if t:
                t = clean_text(t)
                # Accept unless trafilatura lost a big chunk of the body —
                # shorter IS expected (that's the boilerplate going away).
                if len(t) >= int(len(np_text) * 0.6) or len(t) > len(np_text):
                    return t
        except Exception as e:                      # noqa: BLE001
            print(f"     trafilatura failed ({e}); falling back to newspaper3k")

    return np_text


# ═══════════════════════════════════════════════════════════════════
# Enrich one candidate
# ═══════════════════════════════════════════════════════════════════
def enrich_article(item: dict, spec: SourceSpec) -> Optional[dict]:
    url = item["url"]
    topic = item["topic"]
    print(f"  enrich [{topic}] {url}")

    try:
        nlp.ensure_nltk()
        from newspaper import Article, Config

        np_cfg = Config()
        np_cfg.browser_user_agent = config.USER_AGENT
        np_cfg.request_timeout = config.REQUEST_TIMEOUT

        art = Article(url, config=np_cfg)
        response = http.get(url)
        rendered_html = http.html_text(response) if response is not None else None
        if not rendered_html and spec.use_playwright:
            rendered_html = http.fetch_rendered_html(url)
        if rendered_html:
            art.set_html(rendered_html)
            art.parse()
        else:
            item['rejection'] = 'fetch_failed'
            return None

        # Raw soup for body + meta extraction. Reuse the HTML newspaper3k
        # already downloaded instead of fetching the page a second time.
        page_html = rendered_html or getattr(art, "html", "") or ""
        if page_html:
            soup = BeautifulSoup(page_html, "html.parser")
        else:
            soup = http.fetch_soup(url, timeout=12) or BeautifulSoup("", "html.parser")

        jsonld_items = extract.extract_jsonld(soup)
        jsonld = extract.jsonld_article(jsonld_items)
        og_data = extract.extract_og(soup, url)
        pub_dt, date_source = quality.publication_date(soup, jsonld, og_data, art.publish_date, url, item.get('published_hint'))
        reason = quality.date_rejection(pub_dt, config.MAX_AGE_DAYS)
        title = jsonld.get('jsonld_headline') or art.title or og_data.get('og_title') or ''
        if reason or quality.NON_ARTICLE.search(title):
            item['rejection'] = reason or 'non_article'
            print(f"     reject: {item['rejection']}")
            return None
        fallback = _extract_body(art, page_html, spec, soup)
        text, blocks = quality.structured_body(soup, spec.content_selectors, fallback, spec.boilerplate_extra)
        original_length = len(text)
        kept, size = [], 0
        for block in blocks:
            value = '\n'.join(block.get('items', [])) if block['type'] == 'list' else block['text']
            if size + len(value) > config.MAX_CONTENT_CHARS:
                break
            kept.append(block)
            size += len(value) + 2
        blocks = kept
        text = '\n\n'.join('\n'.join(b['items']) if b['type'] == 'list' else b['text'] for b in blocks)
        if len(text) < config.MIN_TEXT_LEN:
            item['rejection'] = 'short_body'
            print("     too short, skip")
            return None
        if spec.language == "en" and len(text.split()) < config.MIN_WORDS_EN:
            item['rejection'] = 'short_body'
            print("     too few words, skip")
            return None

        # Run expensive classification only after date/body validation and
        # only for candidates actually needed to fill the category quota.
        if not spec.skip_zero_shot:
            item['title_hint'] = title
            from core.taxonomy import classification_context
            item['content_hint'] = classification_context(text)
            item['source_key'] = spec.key
            if not nlp.zero_shot_filter([item]):
                item.setdefault('rejection', 'category_unverified')
                print(f"     reject: {item['rejection']}")
                return None

        video_url = extract.extract_video(soup, url, jsonld_items)
        related_urls = extract.extract_related(soup, url)
        author_info = extract.extract_author(soup, url, art.authors, jsonld)

        # Language first — sentiment/summary/toxicity are routed by it
        # (FinBERT/BART/toxic-bert are English-only; XLM-R models handle the rest).
        language = nlp.detect_language(text)
        # langdetect is unreliable on CJK — it frequently tags Traditional Chinese
        # as 'ko'/'ja'/'zh-cn' and returns lowercase codes ('zh-tw'). For a source
        # that declares a fixed non-English language, trust the spec UNLESS detection
        # is confidently English (a rare English wire article in a zh section should
        # still route to the English-only models). This also normalises casing
        # (langdetect 'zh-tw' -> canonical spec 'zh-TW').
        if spec.language != "en" and not (language or "").startswith("en"):
            language = spec.language          # e.g. yahoo_tw -> zh-TW

        entities = nlp.run_ner(text)
        sentiment = nlp.analyze_sentiment(text, topic, language)
        summary_result = summarizer.summarize(quality.summary_body(blocks), language, title)
        ai_summary = summary_result['text']
        toxicity = nlp.run_toxicity(text, language)
        keywords = nlp.extract_keywords(text, art.keywords or [], entities,
                                        top_n=config.KEYWORDS_TOP_N)
        readability = nlp.reading_metrics(text, language)

        desc = (
            og_data.get("og_description")
            or jsonld.get("jsonld_description")
            or (art.summary.strip() if art.summary else "")
            or _lead_sentences(text)
        )

        pub_iso = pub_dt.isoformat()
        modified = quality.parse_date(jsonld.get('jsonld_dateModified') or og_data.get('modified_meta'))
        mod_iso = modified.isoformat() if modified and modified >= pub_dt else None
        canonical = normalize_canonical(og_data.get("canonical_url") or url)
        if not http.same_family(canonical, url):
            canonical = normalize_canonical(url)
        images = quality.validate_images(quality.image_candidates(soup, url, jsonld, art.top_image))

        record = {
            "id": url_id(canonical),
            "url": url,
            "canonical_url": canonical,
            "source": source_meta(url),
            "author": author_info["name"],
            "author_url": author_info["url"],
            "title": title,
            "description": desc,
            "content": text,
            "ai_summary": ai_summary,
            "url_to_image": images[0]['url'] if images else None,
            "images": images,
            "content_blocks": blocks,
            "content_hash": quality.content_hash(text),
            "extraction_version": quality.VERSION,
            "summary_method": summary_result['method'],
            "quality_metadata": {'date_source': date_source, 'image_status': 'verified' if images else 'unavailable', 'summary_evidence': summary_result['evidence'], 'source_categories': item.get('source_categories', [topic]), 'content_truncated': len(text) < original_length, 'original_content_chars': original_length, 'category_model': item.get('category_model'), 'category_taxonomy': item.get('category_taxonomy')},
            "video_url": video_url,
            "published_at": pub_iso,
            "modified_at": mod_iso,
            "scraped_at": datetime.now(timezone.utc).isoformat(),
            "topic": topic,
            "section": og_data.get("section") or jsonld.get("jsonld_genre"),
            "meta_tags": og_data.get("meta_tags", []),
            "og_type": og_data.get("og_type"),
            "language": language,
            "sentiment": sentiment,
            "toxicity": toxicity,
            "keywords": keywords,
            "entities": entities,
            "readability": readability,
            "related_urls": related_urls,
            "ai_relevance": item.get("ai_relevance_score", 1.0),
            "ai_top_label": item.get("ai_top_label"),
            "ai_label_scores": item.get("ai_label_scores", {}),
            "is_premium": jsonld.get("jsonld_isPremium"),
            "is_accessible_free": jsonld.get("jsonld_isAccessibleForFree"),
            "jsonld_word_count": jsonld.get("jsonld_wordCount"),
            "og": {
                "title": og_data.get("og_title"),
                "description": og_data.get("og_description"),
                "site_name": og_data.get("og_site_name"),
                "locale": og_data.get("og_locale"),
                "twitter_card": og_data.get("twitter_card"),
                "twitter_site": og_data.get("twitter_site"),
            },
        }

        s = sentiment
        print(
            f"     ok {s['type'].upper()} | conf={s['score']:.2f} | pol={s['comparative']:+.2f} | "
            f"kw={len(keywords)} | wc={readability['word_count']}"
            f"{' | video' if video_url else ''}"
        )
        return record

    except Exception as e:                          # noqa: BLE001
        item['rejection'] = 'extraction_error'
        print(f"     error: {e}")
        return None


# ═══════════════════════════════════════════════════════════════════
# Run one source end to end
# ═══════════════════════════════════════════════════════════════════
def _assign_topic(candidates: list[dict]) -> list[dict]:
    """Section-trusted path (skip zero-shot): mark every candidate relevant."""
    for item in candidates:
        item.setdefault("ai_relevance_score", 1.0)
        item.setdefault("ai_top_label", item["topic"])
        item.setdefault("ai_label_scores", {})
    return candidates


def run_source(
    spec: SourceSpec,
    *,
    to_db: bool = True,
    conn=None,
    global_seen: Optional[set[str]] = None,
    stats: Optional[dict] = None,
    attempted_urls: Optional[set[str]] = None,
    candidate_limit: Optional[int] = None,
    discovery_target: Optional[int] = None,
) -> list[dict]:
    """Crawl, filter, enrich and (optionally) upsert one source. Returns records.

    ``global_seen`` / ``stats`` let run_all share one dedup set and one
    inserted/updated/unchanged/errors counter across all sources (the caller
    preloads existing canonicals once). Standalone calls keep the old behavior.
    """
    target = spec.target_per_category
    per_src_mult = config.CRAWL_MULT

    owns_conn = False
    if to_db and conn is None:
        conn = db.connect()
        owns_conn = True

    if global_seen is None:
        global_seen = set()
        if to_db:
            global_seen |= db.existing_canonicals(conn)
    if stats is None:
        stats = {"inserted": 0, "updated": 0, "unchanged": 0, "errors": 0}

    collected: list[dict] = []
    print("=" * 70)
    print(f"SOURCE: {spec.name}  (target {target}/category)")
    print("=" * 70)

    for category, urls in spec.categories.items():
        print(f"\n-- {category} --")
        # Small fair-share batches still discover for the original full quota.
        per_src_target = min(120, max(40, ((discovery_target or target) * per_src_mult * 2) // max(1, len(urls))))

        raw_pool: list[dict] = []
        for feed in spec.feeds.get(category, []):
            raw_pool += http.crawl_feed(feed, category, per_src_target, urls[0])
        cat_articles: list[dict] = []
        attempted = attempted_urls if attempted_urls is not None else set()
        def candidates():
            # Try dated feeds first. Only accepted articles fill a quota: a
            # large but stale/mismatched RSS feed must not suppress the section
            # fallback (the previous raw-feed-length gate did exactly that).
            batches = [lambda: raw_pool] + [lambda u=u: http.crawl_source(u, category, per_src_target, rendered=spec.use_playwright) for u in urls]
            for discover in batches:
                if len(cat_articles) >= target:
                    return
                pool = discover()
                stats[f'discovered_{spec.key}_{category}'] = stats.get(f'discovered_{spec.key}_{category}', 0) + len(pool)
                pool.sort(key=lambda x: -((quality.parse_date(x.get('published_hint')) or date_from_url(x['url'])).timestamp() if quality.parse_date(x.get('published_hint')) or date_from_url(x['url']) else 0.0))
                for item in _assign_topic(pool):
                    if candidate_limit and attempts >= candidate_limit:
                        return
                    canonical = normalize_canonical(item['url'])
                    if canonical in attempted or canonical in global_seen:
                        continue
                    attempted.add(canonical)
                    hint = quality.parse_date(item.get('published_hint')) or date_from_url(item['url'])
                    if hint and quality.date_rejection(hint, config.MAX_AGE_DAYS):
                        stats['skipped_stale_hint'] = stats.get('skipped_stale_hint', 0) + 1
                        continue
                    yield item

        attempts = 0
        for item in candidates():
            if len(cat_articles) >= target:
                break
            if item["url"] in global_seen:
                continue
            attempts += 1
            stage_key = None
            if to_db:
                stage_key, conn = db.staging_with_retry(conn, db.stage_candidate, item, spec.key)
            record = enrich_article(item, spec)
            if record is None:
                reason = 'rejected_' + item.get('rejection', 'unknown')
                stats[reason] = stats.get(reason, 0) + 1
                if to_db:
                    _, conn = db.staging_with_retry(conn, db.reject_candidate, stage_key, item.get('rejection', 'unknown'))
                if candidate_limit and attempts >= candidate_limit:
                    break
                continue
            record['_stage_key'] = stage_key
            ckey = record["canonical_url"]
            if ckey in global_seen:
                if to_db:
                    _, conn = db.staging_with_retry(conn, db.reject_candidate, stage_key, 'duplicate_canonical')
                continue

            if to_db:
                try:
                    # upsert_with_retry reconnects+retries once: Neon drops the
                    # idle connection during the first article's model load, so
                    # the first write of the run would otherwise abort the source.
                    status, conn = db.upsert_with_retry(conn, record)
                    stats[status] = stats.get(status, 0) + 1
                    if status == 'quarantined':
                        continue
                except Exception as e:              # noqa: BLE001
                    try:
                        if conn is not None and not conn.closed:
                            conn.rollback()
                    except Exception:              # noqa: BLE001
                        pass
                    stats["errors"] = stats.get("errors", 0) + 1
                    print(f"     DB insert error: {e}")
                    continue
            global_seen.add(ckey)
            cat_articles.append(record)
            if candidate_limit and attempts >= candidate_limit:
                break

        collected.extend(cat_articles)
        print(f"  collected {len(cat_articles)} for {category}")
        stats[f'deficit_{spec.key}_{category}'] = max(0, target - len(cat_articles))

    if owns_conn:
        conn.close()

    print(f"\n{spec.name}: {len(collected)} articles total")
    return collected
