"""Re-fetch a bounded batch of recently extracted articles after quality fixes.

Dry-run by default; --apply updates matched articles only and preserves archives.
"""
import argparse
import json
from collections import Counter
from core import db, config
from core.pipeline import enrich_article
from sources import all_specs

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--limit', type=int, default=40)
    parser.add_argument('--source', choices=[spec.key for spec in all_specs()])
    parser.add_argument('--id', help='Repair only this existing article ID')
    parser.add_argument('--topic', choices=config.TOPICS, help='Revalidate an explicit target category (requires --id)')
    parser.add_argument('--max-age-hours', type=float, default=48)
    args = parser.parse_args()
    if not 1 <= args.limit <= 100:
        parser.error('--limit must be 1..100')
    if args.topic and not args.id:
        parser.error('--topic requires --id; bulk relabeling is not supported')
    if not 1 <= args.max_age_hours <= 720:
        parser.error('--max-age-hours must be 1..720')
    config.MAX_AGE_DAYS=args.max_age_hours/24
    conn = db.connect()
    with conn.cursor() as cur:
        cur.execute("SELECT id,canonical_url,title,topic,source_id FROM articles WHERE extraction_version='structured-v3' AND published_at >= now()-(%s * interval '1 hour') AND (%s::text IS NULL OR source_id=%s) AND (%s::text IS NULL OR id=%s) ORDER BY published_at DESC LIMIT %s", (args.max_age_hours,args.source,args.source,args.id,args.id,args.limit))
        rows = cur.fetchall()
    conn.close()
    specs = {spec.key:spec for spec in all_specs()}
    report = Counter()
    for article_id,url,title,topic,source in rows:
        item = {'url':url,'title_hint':title,'topic':args.topic or topic}
        record = enrich_article(item, specs[source])
        if record:
            if args.apply:
                conn = db.connect()
                try:
                    status, conn = db.upsert_with_retry(conn,record)
                    if status == 'quarantined':
                        report['quarantined'] += 1
                        continue
                finally:
                    conn.close()
            report['repaired'] += 1
        else:
            reason = item.get('rejection','unknown')
            report[reason] += 1
            if args.apply and not args.topic and reason in ('category_mismatch','old_article','future_date','non_article'):
                conn = db.connect()
                with conn.cursor() as cur:
                    cur.execute('UPDATE articles SET feed_eligible=false WHERE id=%s', (article_id,))
                conn.commit()
                conn.close()
        print(json.dumps(dict(report)), flush=True)
    print(json.dumps({'applied':args.apply, **report}), flush=True)

if __name__ == '__main__':
    main()
