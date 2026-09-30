"""Revalidate current scraper rows after classifier changes; dry-run by default.

Never deletes articles. Ineligible stories remain available through bookmarks.
"""
import argparse
import json
from collections import Counter
from core import db, nlp

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    conn = db.connect()
    with conn.cursor() as cur:
        cur.execute("SELECT id,title,content,topic FROM articles WHERE extraction_version='structured-v3' AND published_at >= now()-interval '30 days'")
        rows = cur.fetchall()
    report = Counter()
    for article_id, title, content, topic in rows:
        item = {'title_hint': title, 'content_hint': (content or '')[:900], 'topic': topic}
        accepted = bool(nlp.zero_shot_filter([item]))
        report['accepted' if accepted else 'quarantined'] += 1
        if args.apply:
            with conn.cursor() as cur:
                cur.execute("UPDATE articles SET feed_eligible=%s, ai_top_label=%s, ai_relevance=%s, ai_label_scores=%s::jsonb, quality_metadata=quality_metadata || %s::jsonb WHERE id=%s",
                            (accepted,item.get('ai_top_label'),item.get('ai_relevance_score'),json.dumps(item.get('ai_label_scores',{})),json.dumps({'category_audit':'strict-title-body-v1','category_accepted':accepted}),article_id))
            conn.commit()
    conn.close()
    print(json.dumps({'applied':args.apply, **report}), flush=True)

if __name__ == '__main__':
    main()
