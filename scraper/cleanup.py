#!/usr/bin/env python
"""Weekly database cleansing: remove stale and out-of-policy rows.

The default run is a DRY RUN that only reports what would be deleted;
--commit applies it in one transaction. What goes:

  1. Articles published more than --days ago (default 30). The public feed
     shows 30 days and ingestion looks back 48 hours, so these are no longer
     shown anywhere except by direct link.
  2. Articles the website can never show, once older than --ineligible-days
     (default 7): failed the publication gate (feed_eligible = false, which
     includes stories without a publisher photo), use an extraction format
     older than structured-v3 or have no reader blocks, lack a photo, or were
     quarantined as contaminated. The feed in server/src/lib/articleQuality.ts
     applies the same rules, so everything kept is eligible to appear.
  3. Staging candidates: rejected ones older than --staging-days (default 14),
     and published ones whose article is gone.
  4. Orphans: translations and authors no article references any more.

Never deleted, whatever their age:
  * articles flagged `protected`, bookmarked, or attached to a user post;
  * the frozen 120-article NLP evaluation sample listed in --protect-file
    (a commit refuses to run if that file is missing or empty);
  * accounts, posts, comments, reports and newsletter history.

Publication receipts of deleted articles are removed with them (that foreign
key does not cascade). Take a backup first; the weekly task does
(server/scripts/db-maintenance.mjs). --vacuum / --vacuum-full reclaim space.
"""
from __future__ import annotations

import argparse
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core import config, db          # noqa: E402  (config also runs load_env)

DEFAULT_DAYS = 30
DEFAULT_INELIGIBLE_DAYS = 7
DEFAULT_STAGING_DAYS = 14
DEFAULT_PROTECT_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "protected-evaluation-ids.txt")


def _table_exists(conn, table: str, schema: str = "public") -> bool:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT 1 FROM information_schema.tables WHERE table_schema = %s AND table_name = %s",
            (schema, table),
        )
        return cur.fetchone() is not None


def load_protected_ids(path: str) -> list[str]:
    """Article ids (16 hex chars) from a file; '#' starts a comment."""
    if not os.path.exists(path):
        return []
    ids = []
    with open(path, encoding="utf-8") as handle:
        for line in handle:
            token = line.split("#", 1)[0].strip()
            if re.fullmatch(r"[0-9a-f]{16}", token):
                ids.append(token)
    return ids


def keep_conditions(conn) -> list[str]:
    """SQL conditions an article must satisfy to be deletable."""
    conds = ["NOT (a.id = ANY(%(protected)s))"]
    if db.column_exists(conn, "articles", "protected"):
        conds.append("COALESCE(a.protected, false) = false")
    if _table_exists(conn, "bookmarks"):
        conds.append("NOT EXISTS (SELECT 1 FROM bookmarks b WHERE b.article_id::text = a.id::text)")
    if _table_exists(conn, "posts"):
        conds.append("NOT EXISTS (SELECT 1 FROM posts p WHERE p.article_id::text = a.id::text)")
    return conds


# Mirrors ACTIVE_ARTICLES in server/src/lib/articleQuality.ts (minus age and
# duplicate checks): a row failing this can never appear on the website.
SHOWABLE = ("(a.feed_eligible = true AND a.extraction_version = 'structured-v3'"
            " AND jsonb_array_length(COALESCE(a.content_blocks, '[]'::jsonb)) > 0"
            " AND NULLIF(btrim(a.url_to_image), '') IS NOT NULL"
            " AND COALESCE(a.quality_metadata->>'content_review_status', '') <> 'quarantined')")


def article_where(conn) -> str:
    stale = "(a.published_at IS NOT NULL AND a.published_at < now() - make_interval(days => %(days)s))"
    age = "COALESCE(a.published_at, a.scraped_at, now())" if db.column_exists(conn, "articles", "scraped_at") else "COALESCE(a.published_at, now())"
    unshowable = f"(NOT {SHOWABLE} AND {age} < now() - make_interval(days => %(ineligible_days)s))"
    return f"({stale} OR {unshowable}) AND " + " AND ".join(keep_conditions(conn))


STAGING_WHERE = (
    "(status = 'rejected' AND COALESCE(updated_at, created_at) < now() - make_interval(days => %(staging_days)s))"
    " OR (status = 'published' AND article_id IS NOT NULL"
    " AND NOT EXISTS (SELECT 1 FROM public.articles a WHERE a.id = staging.articles.article_id))"
)
ORPHAN_TRANSLATIONS = (
    "article_id IS NOT NULL AND NOT EXISTS "
    "(SELECT 1 FROM articles a WHERE a.id::text = translations.article_id::text)"
)
ORPHAN_AUTHORS = "NOT EXISTS (SELECT 1 FROM articles a WHERE a.author_id = authors.id)"


def _count(conn, sql: str, params: dict) -> int:
    with conn.cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchone()[0]


def plan(conn, params: dict) -> dict:
    """Counts for every step, computed as if earlier steps had run."""
    where = article_where(conn)
    counts = {
        "stale_articles": _count(conn, f"SELECT count(*) FROM articles a WHERE a.published_at < now() - make_interval(days => %(days)s) AND {where}", params),
        "articles": _count(conn, f"SELECT count(*) FROM articles a WHERE {where}", params),
        "publication_receipts": _count(conn, f"SELECT count(*) FROM article_publications p WHERE p.article_id IN (SELECT a.id FROM articles a WHERE {where})", params),
    }
    counts["ineligible_articles"] = counts["articles"] - counts["stale_articles"]
    if _table_exists(conn, "articles", "staging"):
        counts["staging_rows"] = _count(conn, f"SELECT count(*) FROM staging.articles WHERE {STAGING_WHERE}", params)
    if _table_exists(conn, "translations"):
        counts["orphan_translations_now"] = _count(conn, f"SELECT count(*) FROM translations WHERE {ORPHAN_TRANSLATIONS}", params)
    if _table_exists(conn, "authors") and db.column_exists(conn, "articles", "author_id"):
        counts["orphan_authors_now"] = _count(conn, f"SELECT count(*) FROM authors WHERE {ORPHAN_AUTHORS}", params)
    return counts


def apply(conn, params: dict) -> dict:
    """Delete everything in one transaction and return the row counts."""
    where = article_where(conn)
    done: dict[str, int] = {}
    with conn.cursor() as cur:
        cur.execute(f"CREATE TEMP TABLE doomed ON COMMIT DROP AS SELECT a.id FROM articles a WHERE {where}", params)
        cur.execute("DELETE FROM article_publications WHERE article_id IN (SELECT id FROM doomed)")
        done["publication_receipts"] = cur.rowcount
        cur.execute("DELETE FROM articles WHERE id IN (SELECT id FROM doomed)")
        done["articles"] = cur.rowcount
        if _table_exists(conn, "articles", "staging"):
            cur.execute(f"DELETE FROM staging.articles WHERE {STAGING_WHERE}", params)
            done["staging_rows"] = cur.rowcount
        if _table_exists(conn, "translations"):
            cur.execute(f"DELETE FROM translations WHERE {ORPHAN_TRANSLATIONS}")
            done["orphan_translations"] = cur.rowcount
        if _table_exists(conn, "authors") and db.column_exists(conn, "articles", "author_id"):
            cur.execute(f"DELETE FROM authors WHERE {ORPHAN_AUTHORS}")
            done["orphan_authors"] = cur.rowcount
    conn.commit()
    return done


def _vacuum(full: bool) -> None:
    """VACUUM (optionally FULL) on its own autocommit connection."""
    import psycopg2
    conn = psycopg2.connect(config.db_dsn())
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            statements = (["VACUUM (FULL, ANALYZE) articles"] if full else []) + ["VACUUM ANALYZE"]
            for stmt in statements:
                print(f"{stmt} ...")
                try:
                    cur.execute(stmt)
                except Exception as e:              # noqa: BLE001
                    print(f"  failed (continuing): {e}")
    finally:
        conn.close()


def main() -> None:
    ap = argparse.ArgumentParser(description="Delete stale and out-of-policy rows (dry run by default).")
    ap.add_argument("--days", type=int, default=DEFAULT_DAYS, help=f"article age threshold (default {DEFAULT_DAYS})")
    ap.add_argument("--ineligible-days", type=int, default=DEFAULT_INELIGIBLE_DAYS,
                    help=f"age before ineligible articles go (default {DEFAULT_INELIGIBLE_DAYS})")
    ap.add_argument("--staging-days", type=int, default=DEFAULT_STAGING_DAYS,
                    help=f"age before rejected staging candidates go (default {DEFAULT_STAGING_DAYS})")
    ap.add_argument("--protect-file", default=DEFAULT_PROTECT_FILE, help="article ids that are never deleted")
    ap.add_argument("--commit", action="store_true", help="actually delete (default is a dry run)")
    ap.add_argument("--vacuum", action="store_true", help="VACUUM ANALYZE afterwards")
    ap.add_argument("--vacuum-full", action="store_true", help="VACUUM FULL articles, then VACUUM ANALYZE")
    args = ap.parse_args()

    if not config.db_dsn():
        raise SystemExit("No DB DSN configured (set NEONDB_URL / DATABASE_URL / NEON_DSN).")
    if min(args.days, args.ineligible_days, args.staging_days) < 1:
        raise SystemExit("Age thresholds must be at least 1 day.")
    protected = load_protected_ids(args.protect_file)
    if args.commit and not protected:
        raise SystemExit(f"Refusing to delete: no protected evaluation ids found in {args.protect_file}.")
    params = {"days": args.days, "ineligible_days": args.ineligible_days,
              "staging_days": args.staging_days, "protected": protected}

    conn = db.connect()
    try:
        counts = plan(conn, params)
        print(f"Protected evaluation articles: {len(protected)}")
        for key, value in counts.items():
            print(f"  {key}: {value}")
        if not args.commit:
            print("\nDRY RUN — nothing deleted. Re-run with --commit to apply.")
            return
        done = apply(conn, params)
        print("Deleted: " + ", ".join(f"{k}={v}" for k, v in done.items()))
    finally:
        conn.close()

    if args.vacuum or args.vacuum_full:
        _vacuum(full=args.vacuum_full)


if __name__ == "__main__":
    main()
