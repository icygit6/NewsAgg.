#!/usr/bin/env python
"""Run every source sequentially against the live DB.

Supports --no-db (enrich only, no writes) and --target N (articles per
category per source). Used by .github/workflows/scraper.yml on a schedule.
One source failing never aborts the rest — each is wrapped in try/except.
"""
from __future__ import annotations

import argparse
import os
import sys
import json
import signal
import uuid
from pathlib import Path
from datetime import datetime, timezone
from dataclasses import replace
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core import config, db          # noqa: E402  (config also runs load_env)
from core.pipeline import run_source  # noqa: E402
from sources import all_specs         # noqa: E402


def save_report(path, report):
    if path:
        target = Path(path)
        target.parent.mkdir(parents=True, exist_ok=True)
        temporary = target.with_suffix('.tmp')
        temporary.write_text(json.dumps(report, ensure_ascii=False), encoding='utf-8')
        temporary.replace(target)


def main() -> None:
    ap = argparse.ArgumentParser(description="Scrape all news sources.")
    ap.add_argument("--no-db", action="store_true", help="enrich only; no DB writes")
    ap.add_argument("--target", type=int, default=None,
                    help="articles per category per source (default: config)")
    ap.add_argument('--report-path', help='Atomic JSON manifest for this exact run')
    ap.add_argument('--run-key', default=None)
    ap.add_argument('--max-age-hours', type=float, default=None)
    ap.add_argument('--refresh-existing', action='store_true', help='Recheck recent stored stories in a full rerun; still deduplicate inside this run')
    args = ap.parse_args()
    if args.target is not None and not 1 <= args.target <= 100:
        ap.error('--target must be between 1 and 100')
    if args.max_age_hours is not None:
        if not 1 <= args.max_age_hours <= 720:
            ap.error('--max-age-hours must be between 1 and 720')
        config.MAX_AGE_DAYS = args.max_age_hours / 24

    to_db = not args.no_db
    if to_db and not config.db_dsn():
        ap.error('No DB DSN configured; pass --no-db explicitly for a dry run')

    report = {'runKey': args.run_key or str(uuid.uuid4()), 'startedAt': datetime.now(timezone.utc).isoformat(),
              'finishedAt': None, 'status': 'running', 'errors': 0, 'articleIds': [], 'counts': {}}
    save_report(args.report_path, report)
    os.environ['NEWSAGG_RUN_KEY'] = report['runKey']
    def terminate(_signum, _frame):
        raise KeyboardInterrupt('Scraper deadline or shutdown')
    signal.signal(signal.SIGTERM, terminate)
    try:
        execute(args, to_db, report)
    except (Exception, KeyboardInterrupt) as exc:
        report['status'] = 'failed'
        report['errors'] = max(1, report['errors'])
        # Do not expose connection strings or credentials in the manifest.
        report['failureType'] = type(exc).__name__
        print(f'Run failed: {type(exc).__name__}')
    finally:
        # Docker/Windows can forward more than one shutdown signal. The first
        # ends scraping; subsequent signals must not interrupt the final report.
        signal.signal(signal.SIGTERM, signal.SIG_IGN)
        signal.signal(signal.SIGINT, signal.SIG_IGN)
        report['finishedAt'] = datetime.now(timezone.utc).isoformat()
        save_report(args.report_path, report)
        if report.get('dbRunId'):
            try:
                with db.connect() as report_conn:
                    with report_conn.cursor() as cur:
                        payload = {**report['counts'], 'runKey': report['runKey'], 'articleIds': report['articleIds']}
                        cur.execute('UPDATE scraper_runs SET finished_at=now(),status=%s,report=%s::jsonb WHERE id=%s',
                                    (report['status'], json.dumps(payload), report['dbRunId']))
                report_conn.close()
            except Exception:
                report.update(status='failed', errors=max(1, report['errors']), failureType='ReportPersistenceFailure')
                save_report(args.report_path, report)
    if report['errors']:
        raise SystemExit(1)


def execute(args, to_db, report):
    conn = db.connect() if to_db else None
    try:
        scrape(args, to_db, report, conn)
    finally:
        if conn is not None:
            conn.close()


def scrape(args, to_db, report, conn):
    all_records: list[dict] = []

    # One shared dedup set + one stats counter for the whole run: existing
    # canonicals are preloaded ONCE (one DB roundtrip instead of one per
    # source) and sources can't re-enrich each other's articles.
    global_seen: set[str] = set()
    if conn is not None and not args.refresh_existing:
        global_seen |= db.existing_canonicals(conn)
    stats = {"inserted": 0, "updated": 0, "unchanged": 0, "errors": 0}
    report['counts'] = stats
    run_id = None
    counts = {}
    if conn is not None:
        with conn.cursor() as cur:
            # Concurrent manual/scheduled runs must not compete for quotas.
            cur.execute('SELECT pg_try_advisory_lock(731906)')
            if not cur.fetchone()[0]:
                print('Another scraper run is active; skipping this run.')
                raise RuntimeError('Another scraper run is active')
            cur.execute("INSERT INTO scraper_runs DEFAULT VALUES RETURNING id")
            run_id = cur.fetchone()[0]
            report['dbRunId'] = run_id
            cur.execute("SELECT topic,source_id,count(*) FROM articles WHERE feed_eligible AND extraction_version='structured-v3' AND published_at >= now()-(%s * interval '1 day') AND published_at <= now()+interval '2 hours' GROUP BY topic,source_id", (config.MAX_AGE_DAYS,))
            counts = {(topic, source): count for topic, source, count in cur.fetchall()}
        conn.commit()

    specs = all_specs()
    topics = set(topic for spec in specs for topic in spec.categories)
    # First give EVERY source/category a bounded opportunity, then fill the
    # remaining quota. A hard category cannot monopolize the full run budget.
    pairs = []
    for topic in sorted(topics, key=lambda t: (sum(v for (cat, _),v in counts.items() if cat == t), t)):
        for original in sorted((s for s in specs if topic in s.categories), key=lambda s: (counts.get((topic,s.key),0),s.key)):
            pairs.append((topic, original))
    obtained, attempted = Counter(), {}
    for topic, original in pairs:
        stats[f'deficit_{original.key}_{topic}'] = args.target or original.target_per_category
    for first_pass in (True, False):
        for topic, original in pairs:
            if conn is not None:
                # Enrichment can outlive an idle Neon connection. A short-lived
                # read here does not depend on the parent's old connection.
                capacity_conn = db.connect()
                try:
                    with capacity_conn.cursor() as cur:
                        cur.execute('SELECT pg_database_size(current_database())')
                        used = cur.fetchone()[0]
                finally:
                    capacity_conn.close()
                if used >= config.STORAGE_BUDGET_BYTES - config.STORAGE_HEADROOM_BYTES:
                    stats['storage_budget_reached'] = 1
                    print('Storage safety threshold reached; preserving existing articles and stopping ingestion.')
                    break
            key = (original.key, topic)
            target = args.target or original.target_per_category
            wanted = min(2, target) if first_pass else target
            remaining = wanted - obtained[key]
            if remaining <= 0:
                continue
            spec = replace(original, categories={topic: original.categories[topic]}, target_per_category=remaining)
            try:
                records = run_source(spec, to_db=to_db, global_seen=global_seen, stats=stats,
                                     attempted_urls=attempted.setdefault(key, set()), candidate_limit=12 if first_pass else None)
                all_records += records
                obtained[key] += len(records)
            except Exception as e:
                stats['errors'] += 1
                print(f"!! source {spec.key}/{topic} failed: {e}")
            stats[f'deficit_{original.key}_{topic}'] = max(0, target-obtained[key])
            report['articleIds'] = sorted({r['id'] for r in all_records})
            save_report(args.report_path, report)

    report['errors'] = stats['errors']
    report['status'] = 'failed' if stats['errors'] else ('partial' if any(v for k,v in stats.items() if k.startswith('deficit_')) else 'complete')

    by_src = Counter(r["source"]["id"] for r in all_records)
    by_topic = Counter(r["topic"] for r in all_records)
    by_sent = Counter(r["sentiment"]["type"] for r in all_records)

    print("\n" + "=" * 70)
    print(f"DONE — {len(all_records)} articles across {len(by_src)} sources")
    print("=" * 70)
    print("By source:", dict(by_src))
    print("By topic :", dict(by_topic))
    print("By tone  :", dict(by_sent))
    if to_db:
        print("DB       :", " | ".join(f"{k}={v}" for k, v in stats.items()))


if __name__ == "__main__":
    main()
