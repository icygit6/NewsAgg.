"""Refresh summaries of active stored articles. Preserves original content/dates.

This does not claim to recover DOM headings or verify remote images; those
require a publisher re-scrape. Old articles remain accessible as archives.
"""
import argparse
import json
from collections import Counter
from core import db, summarizer, quality

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--limit', type=int, default=10000)
    parser.add_argument('--verified-only', action='store_true', help='only articles re-extracted by the current scraper')
    args = parser.parse_args()
    conn = db.connect()
    report = Counter()
    pending = []
    def flush():
        if not pending:
            return
        from psycopg2.extras import execute_batch
        with conn.cursor() as cur:
            execute_batch(cur, """UPDATE articles SET ai_summary=%s,summary_method=%s,content_hash=%s,
                quality_metadata=quality_metadata || %s::jsonb WHERE id=%s""", pending, page_size=50)
        conn.commit()
        pending.clear()
    with conn.cursor() as cur:
        cur.execute("""SELECT id,title,content,language FROM articles
            WHERE published_at >= now()-interval '30 days' AND published_at <= now()+interval '2 hours'
            AND (summary_method IS NULL OR summary_method NOT LIKE 'extractive-%%-v4')
            AND (NOT %s OR extraction_version='structured-v3')
            ORDER BY published_at DESC LIMIT %s""", (args.verified_only, args.limit))
        rows = cur.fetchall()
    for article_id, title, text, language in rows:
        if not text or len(text) < 300:
            report['insufficient_text'] += 1
            continue
        summary = summarizer.summarize(text, language or 'en', title)
        if args.apply:
            pending.append((summary['text'],summary['method'],quality.content_hash(text),json.dumps({'summary_evidence':summary['evidence'], 'backfill':'stored-text-only'}),article_id))
            if len(pending) >= 50:
                flush()
        report['summaries'] += 1
        if report['summaries'] % 100 == 0:
            print(dict(report), flush=True)
    flush()
    print(json.dumps({'applied':args.apply, **report}), flush=True)
    conn.close()

if __name__ == '__main__':
    main()
