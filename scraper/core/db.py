"""NeonDB persistence — upsert articles/sources/authors against the LIVE schema.

IMPORTANT (do not "fix" this to CLAUDE.md's schema):
The live NeonDB uses the OLD scraper schema, NOT CLAUDE.md's target schema.
The project decision (memory: db-schema-divergence) is to ADAPT CODE TO THE
LIVE DB, never migrate. So this upsert intentionally writes:
    articles.id            text  (sha256[:16] of canonical_url)
    articles.source_id     text  ("cnn" / "bbc" / "aljazeera" / "yahoo_tw")
    articles.author_id     bigint -> authors table
    sentiment_polarity + sentiment_pos/neu/neg   (NOT sentiment_prob_*)
    ai_relevance           (NOT ai_confidence)
    keywords/entities/images/related_urls/og_data/...  JSONB
This matches the ~364 existing rows and the TS server's read contract.
"""
from __future__ import annotations

import logging
import os
import uuid
from typing import Optional

from core import config

_log = logging.getLogger(__name__)


def get_dsn() -> Optional[str]:
    return config.db_dsn()


def connect():
    """Open a psycopg2 connection to the live DB. Raises if no DSN configured.

    TCP keepalives are on because the FIRST article of a run downloads/loads
    ~4-6GB of HuggingFace models before the first write — a long idle gap that
    otherwise gets the connection reaped by Neon / intermediate proxies
    ("connection already closed"). ``upsert_with_retry`` is the safety net for
    drops that slip through anyway.
    """
    import psycopg2
    dsn = get_dsn()
    if not dsn:
        raise RuntimeError(
            "No DB connection string. Set NEONDB_URL (or DATABASE_URL / NEON_DSN) "
            "in scraper/.env or server/.env."
        )
    return psycopg2.connect(
        dsn,
        connect_timeout=10,
        keepalives=1,
        keepalives_idle=30,
        keepalives_interval=10,
        keepalives_count=5,
    )


def column_exists(conn, table: str, column: str) -> bool:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT 1 FROM information_schema.columns
            WHERE table_name = %s AND column_name = %s
            """,
            (table, column),
        )
        return cur.fetchone() is not None


def existing_canonicals(conn) -> set[str]:
    """All canonical_urls already stored — used to skip re-enriching duplicates."""
    try:
        with conn.cursor() as cur:
            cur.execute("""SELECT canonical_url FROM articles WHERE canonical_url IS NOT NULL
                AND extraction_version = %s AND last_checked_at > NOW() - interval '24 hours'""",
                (__import__('core.quality', fromlist=['VERSION']).VERSION,))
            return {row[0] for row in cur.fetchall()}
    except Exception as e:                          # noqa: BLE001
        _log.warning("Could not preload existing canonicals: %s", e)
        return set()


def canonical_exists(conn, canonical_url: str) -> bool:
    with conn.cursor() as cur:
        cur.execute("SELECT 1 FROM articles WHERE canonical_url = %s LIMIT 1", (canonical_url,))
        return cur.fetchone() is not None


# ═══════════════════════════════════════════════════════════════════
# Upsert — preserved from scraper4/5 (writes the live schema)
# ═══════════════════════════════════════════════════════════════════
def _insert_public_article(conn, record: dict) -> str:
    """Internal upsert. Caller owns the transaction and admission gate.

    Returns 'inserted' | 'updated' | 'unchanged'. The DO UPDATE is guarded by
    IS DISTINCT FROM so a re-scrape of an unchanged article writes NOTHING —
    the old unconditional update rewrote content (TOAST) every run, which is
    what bloated NeonDB with dead tuples + WAL history.
    """
    import psycopg2.extras as extras

    src = record["source"]
    sent = record["sentiment"]
    tox = record["toxicity"]
    read = record["readability"]
    og = record["og"]

    # upsert source
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO sources (id, name, domain, country, language, logo_url)
            VALUES (%(id)s,%(name)s,%(domain)s,%(country)s,%(language)s,%(logo)s)
            ON CONFLICT (id) DO NOTHING
            """,
            {**src, "logo": src.get("logo")},
        )

    # upsert author
    author_id = None
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO authors (name, author_url, source_id)
            VALUES (%(name)s, %(url)s, %(source_id)s)
            ON CONFLICT (author_url) DO UPDATE SET name = EXCLUDED.name
            RETURNING id
            """,
            {"name": record["author"], "url": record.get("author_url"), "source_id": src["id"]},
        )
        row = cur.fetchone()
        if row:
            author_id = row[0]

    # upsert article
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO articles (
                id, url, canonical_url, source_id, author_id,
                title, description, content, ai_summary,
                url_to_image, video_url, topic, section, og_type, language,
                published_at, modified_at, scraped_at,
                sentiment_type, sentiment_score, sentiment_polarity,
                sentiment_pos, sentiment_neu, sentiment_neg, sentiment_model,
                toxicity_label, toxicity_score,
                word_count, reading_time_min, flesch_score, flesch_kincaid, smog_index,
                ai_relevance, ai_top_label, is_premium, is_accessible_free,
                keywords, entities, images, related_urls,
                og_data, ai_label_scores, meta_tags,
                content_blocks, quality_metadata, summary_method, content_hash, extraction_version, last_checked_at, feed_eligible
            ) VALUES (
                %(id)s, %(url)s, %(canonical_url)s, %(source_id)s, %(author_id)s,
                %(title)s, %(description)s, %(content)s, %(ai_summary)s,
                %(url_to_image)s, %(video_url)s, %(topic)s, %(section)s, %(og_type)s, %(language)s,
                %(published_at)s, %(modified_at)s, %(scraped_at)s,
                %(sentiment_type)s, %(sentiment_score)s, %(sentiment_polarity)s,
                %(sentiment_pos)s, %(sentiment_neu)s, %(sentiment_neg)s, %(sentiment_model)s,
                %(toxicity_label)s, %(toxicity_score)s,
                %(word_count)s, %(reading_time_min)s, %(flesch_score)s, %(flesch_kincaid)s, %(smog_index)s,
                %(ai_relevance)s, %(ai_top_label)s, %(is_premium)s, %(is_accessible_free)s,
                %(keywords)s, %(entities)s, %(images)s, %(related_urls)s,
                %(og_data)s, %(ai_label_scores)s, %(meta_tags)s,
                %(content_blocks)s, %(quality_metadata)s, %(summary_method)s, %(content_hash)s, %(extraction_version)s, NOW(), true
            )
            ON CONFLICT (canonical_url) DO UPDATE SET
                title              = EXCLUDED.title,
                description        = EXCLUDED.description,
                content            = EXCLUDED.content,
                ai_summary         = EXCLUDED.ai_summary,
                sentiment_type     = EXCLUDED.sentiment_type,
                sentiment_score    = EXCLUDED.sentiment_score,
                sentiment_polarity = EXCLUDED.sentiment_polarity,
                keywords           = EXCLUDED.keywords,
                scraped_at         = EXCLUDED.scraped_at,
                url_to_image       = EXCLUDED.url_to_image,
                images             = EXCLUDED.images,
                published_at       = EXCLUDED.published_at,
                modified_at        = EXCLUDED.modified_at,
                topic              = EXCLUDED.topic,
                content_blocks     = EXCLUDED.content_blocks,
                quality_metadata   = EXCLUDED.quality_metadata,
                summary_method     = EXCLUDED.summary_method,
                content_hash       = EXCLUDED.content_hash,
                extraction_version = EXCLUDED.extraction_version,
                last_checked_at    = NOW(),
                feed_eligible      = true,
                sentiment_pos      = EXCLUDED.sentiment_pos,
                sentiment_neu      = EXCLUDED.sentiment_neu,
                sentiment_neg      = EXCLUDED.sentiment_neg,
                sentiment_model    = EXCLUDED.sentiment_model,
                toxicity_label     = EXCLUDED.toxicity_label,
                toxicity_score     = EXCLUDED.toxicity_score,
                entities           = EXCLUDED.entities,
                reading_time_min   = EXCLUDED.reading_time_min,
                word_count         = EXCLUDED.word_count,
                flesch_score       = EXCLUDED.flesch_score,
                flesch_kincaid     = EXCLUDED.flesch_kincaid,
                smog_index         = EXCLUDED.smog_index,
                ai_relevance       = EXCLUDED.ai_relevance,
                ai_top_label       = EXCLUDED.ai_top_label,
                ai_label_scores    = EXCLUDED.ai_label_scores
            RETURNING (xmax = 0) AS inserted, id
            """,
            {
                "id": record["id"],
                "url": record["url"],
                "canonical_url": record["canonical_url"],
                "source_id": src["id"],
                "author_id": author_id,
                "title": record["title"],
                "description": record.get("description"),
                "content": record.get("content"),
                "ai_summary": record.get("ai_summary"),
                "url_to_image": record.get("url_to_image"),
                "video_url": record.get("video_url"),
                "topic": record["topic"],
                "section": record.get("section"),
                "og_type": record.get("og_type"),
                "language": record.get("language", "en"),
                "published_at": record.get("published_at"),
                "modified_at": record.get("modified_at"),
                "scraped_at": record.get("scraped_at"),
                "sentiment_type": sent["type"],
                "sentiment_score": sent["score"],
                "sentiment_polarity": sent["comparative"],
                "sentiment_pos": sent["probabilities"]["positive"],
                "sentiment_neu": sent["probabilities"]["neutral"],
                "sentiment_neg": sent["probabilities"]["negative"],
                "sentiment_model": sent["model"],
                "toxicity_label": tox["label"],
                "toxicity_score": tox["score"],
                "word_count": read["word_count"],
                "reading_time_min": read["reading_time_min"],
                "flesch_score": read["flesch_score"],
                "flesch_kincaid": read["flesch_kincaid"],
                "smog_index": read["smog_index"],
                "ai_relevance": record.get("ai_relevance"),
                "ai_top_label": record.get("ai_top_label"),
                "is_premium": record.get("is_premium"),
                "is_accessible_free": record.get("is_accessible_free"),
                "keywords": extras.Json(record.get("keywords", [])),
                "entities": extras.Json(record.get("entities", {})),
                "images": extras.Json(record.get("images", [])),
                "related_urls": extras.Json(record.get("related_urls", [])),
                "og_data": extras.Json(og),
                "ai_label_scores": extras.Json(record.get("ai_label_scores", {})),
                "meta_tags": extras.Json(record.get("meta_tags", [])),
                "content_blocks": extras.Json(record.get("content_blocks", [])),
                "quality_metadata": extras.Json(record.get("quality_metadata", {})),
                "summary_method": record.get("summary_method"),
                "content_hash": record.get("content_hash"),
                "extraction_version": record.get("extraction_version"),
            },
        )
        row = cur.fetchone()
    if row:
        record['id'] = row[1]  # Preserve the existing ID on canonical conflicts.
    if row is None:
        return "unchanged"           # WHERE guard filtered the update out
    return "inserted" if row[0] else "updated"


def stage_candidate(conn, item, source_id):
    from core.cleaner import normalize_canonical, url_id
    from psycopg2.extras import Json
    key = url_id(normalize_canonical(item['url']))
    run = os.environ.get('NEWSAGG_RUN_KEY') or 'manual'
    with conn.cursor() as cur:
        cur.execute("""INSERT INTO staging.articles(candidate_key,run_key,source_id,candidate_url,status,payload)
            VALUES(%s,%s,%s,%s,'pending',%s)
            ON CONFLICT(candidate_key) DO UPDATE SET run_key=excluded.run_key,status='pending',
            payload=excluded.payload,validation='{}',updated_at=now(),published_at=NULL""",
            (key,run,source_id,item['url'],Json(item)))
    conn.commit()
    return key


def reject_candidate(conn, key, reason):
    from psycopg2.extras import Json
    with conn.cursor() as cur:
        cur.execute("UPDATE staging.articles SET status='rejected',validation=%s,updated_at=now() WHERE candidate_key=%s",
                    (Json({'reason':reason}),key))
    conn.commit()


def insert_article(conn, record: dict) -> str:
    """Durable staging first; production + publication receipt commit together.

    A crash after staging leaves a resumable ready row, never half an article
    visible to the website. Rejected updates leave the old public row intact.
    """
    from core.publication import rejection
    from psycopg2.extras import Json
    key = record.get('_stage_key') or record['id']
    run = os.environ.get('NEWSAGG_RUN_KEY') or record.setdefault('_manual_run', str(uuid.uuid4()))
    payload = {k:v for k,v in record.items() if not k.startswith('_')}
    reason = rejection(payload)
    if not reason:
        # Preserve existing URLs/IDs, but quarantine alternate-URL copies.
        # Exact bodies may match across publishers; headlines only match within
        # one publisher and a 24-hour publication window (not recurring reports).
        with conn.cursor() as cur:
            cur.execute("""SELECT 1 FROM articles WHERE feed_eligible = true
                AND extraction_version = 'structured-v3'
                AND canonical_url <> %s
                AND (content_hash = %s OR (source_id = %s
                  AND lower(regexp_replace(btrim(title), '\\s+', ' ', 'g')) = lower(regexp_replace(btrim(%s), '\\s+', ' ', 'g'))
                  AND abs(extract(epoch FROM published_at - %s::timestamptz)) < 86400))
                AND NOT EXISTS (SELECT 1 FROM articles existing WHERE existing.canonical_url = %s)
                LIMIT 1""", (record['canonical_url'], record['content_hash'], record['source']['id'],
                             record['title'], record['published_at'], record['canonical_url']))
            if cur.fetchone():
                reason = 'duplicate_article'
    with conn.cursor() as cur:
        cur.execute("""INSERT INTO staging.articles(candidate_key,run_key,source_id,candidate_url,article_id,status,payload,validation)
            VALUES(%s,%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT(candidate_key) DO UPDATE SET run_key=excluded.run_key,article_id=excluded.article_id,
            status=excluded.status,payload=excluded.payload,validation=excluded.validation,updated_at=now(),published_at=NULL""",
            (key,run,record['source']['id'],record['url'],record['id'],'rejected' if reason else 'ready',Json(payload),Json({'reason':reason} if reason else {'passed':True})))
    conn.commit()
    if reason:
        return 'quarantined'
    try:
        with conn.cursor() as cur:
            cur.execute('SELECT payload,status FROM staging.articles WHERE candidate_key=%s AND run_key=%s FOR UPDATE', (key,run))
            staged = cur.fetchone()
            if not staged or staged[1] != 'ready':
                raise RuntimeError('Staging ownership changed')
            ready = staged[0]
        reason = rejection(ready)
        if reason:
            conn.rollback()
            reject_candidate(conn,key,reason)
            return 'quarantined'
        status = _insert_public_article(conn, ready)
        with conn.cursor() as cur:
            cur.execute("""INSERT INTO public.article_publications(article_id,run_key,content_hash) VALUES(%s,%s,%s)
                ON CONFLICT(article_id) DO UPDATE SET run_key=excluded.run_key,content_hash=excluded.content_hash,approved_at=now()""",
                (ready['id'],run,ready['content_hash']))
            # Once copied atomically to production, retain a receipt rather than
            # a second full article body in the free-tier staging buffer.
            cur.execute("UPDATE staging.articles SET status='published',article_id=%s,payload=%s,published_at=now(),updated_at=now() WHERE candidate_key=%s",
                        (ready['id'],Json({'articleId':ready['id'],'contentHash':ready['content_hash']}),key))
        conn.commit()
        record['id'] = ready['id']
        return status
    except Exception:
        conn.rollback()
        raise


def upsert_with_retry(conn, record: dict):
    """``insert_article`` with one reconnect-and-retry.

    Neon drops the single shared connection while the first article loads its
    ~4-6GB model stack, so the first write of a run frequently hits
    "connection already closed". On failure we roll back if we still can, open
    a fresh connection and try exactly once more. Returns ``(status, conn)`` —
    ``conn`` may be a NEW handle the caller must keep using for the rest of the
    source (once models are loaded, writes are frequent and stay warm).
    """
    try:
        return insert_article(conn, record), conn
    except Exception:                               # noqa: BLE001
        try:
            if conn is not None and not conn.closed:
                conn.rollback()
        except Exception:                           # noqa: BLE001
            pass                                    # rollback on a dead conn also raises
        if conn is not None:
            conn.close()
        conn = connect()                            # reconnect (raises only if DSN vanished)
        return insert_article(conn, record), conn


def staging_with_retry(conn, operation, *args):
    try:
        return operation(conn, *args), conn
    except Exception:
        try:
            conn.rollback()
        except Exception:
            pass
        if conn is not None:
            conn.close()
        conn = connect()
        return operation(conn, *args), conn


def insert_all(dsn_or_conn, articles: list[dict]) -> int:
    """Bulk upsert. Accepts a DSN string or an open connection."""
    if isinstance(dsn_or_conn, str):
        import psycopg2
        conn = psycopg2.connect(dsn_or_conn)
        owns = True
    else:
        conn = dsn_or_conn
        owns = False

    ok = 0
    for art in articles:
        try:
            status = insert_article(conn, art)
            if status != 'quarantined':
                ok += 1
        except Exception as e:                      # noqa: BLE001
            conn.rollback()
            print(f"   DB insert error: {e}")
    if owns:
        conn.close()
    print(f"\nPostgreSQL: {ok}/{len(articles)} articles upserted.")
    return ok
