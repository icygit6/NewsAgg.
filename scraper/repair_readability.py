"""Recompute current feed metrics only, without re-scraping or altering content.

Default is a read-only preview. --apply updates only rows whose content hash
still matches the input, so concurrent ingestion cannot receive stale metrics.
"""
import argparse
import json
from collections import Counter
from psycopg2.extras import execute_values
from core import db, nlp

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    conn = db.connect()
    try:
        with conn.cursor() as cur:
            cur.execute("""SELECT id,content,language,content_hash,flesch_score,flesch_kincaid,smog_index
                FROM articles WHERE feed_eligible AND extraction_version='structured-v3'
                AND published_at >= now()-interval '30 days' AND content_hash IS NOT NULL""")
            rows = cur.fetchall()
        conn.commit()
        changes = []
        stats = Counter()
        for article_id, text, language, content_hash, old_flesch, old_grade, old_smog in rows:
            values = nlp.reading_metrics(text or '', language or '')
            stats['scanned'] += 1
            stats['english' if (language or '').startswith('en') else 'other_language'] += 1
            if (old_flesch, old_grade, old_smog) != (values['flesch_score'], values['flesch_kincaid'], values['smog_index']):
                changes.append((article_id, content_hash, values['flesch_score'], values['flesch_kincaid'], values['smog_index']))
        if args.apply and changes:
            with conn.cursor() as cur:
                updated = execute_values(cur, """UPDATE articles a SET flesch_score=v.flesch::numeric,
                    flesch_kincaid=v.grade::numeric,smog_index=v.smog::numeric
                    FROM (VALUES %s) AS v(id,hash,flesch,grade,smog)
                    WHERE a.id=v.id AND a.content_hash=v.hash RETURNING a.id""", changes, fetch=True)
                stats['updated'] = len(updated)
            conn.commit()
        stats['changes'] = len(changes)
        print(json.dumps({'apply': args.apply, **stats}))
    finally:
        conn.close()

if __name__ == '__main__': main()
