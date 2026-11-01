import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import patch
from core.deadline import parse_stop_at, stop_requested
from core.pipeline import SourceSpec, run_source
import run_all


class DeadlineTests(unittest.TestCase):
    def test_absolute_cutoff_and_timezone_are_explicit(self):
        deadline = parse_stop_at('2026-10-24T20:20:00+08:00')
        self.assertEqual(deadline.isoformat(), '2026-10-24T12:20:00+00:00')
        self.assertFalse(stop_requested(deadline, deadline - timedelta(seconds=1)))
        self.assertTrue(stop_requested(deadline, deadline))
        self.assertFalse(stop_requested(None))
        for invalid in ('invalid', '2026-10-24T20:20:00'):
            with self.assertRaises(ValueError):
                parse_stop_at(invalid)

    def test_expired_budget_starts_no_discovery_or_enrichment(self):
        spec = SourceSpec(key='test', name='Test', categories={'World': ['https://example.com/world']})
        with patch('core.pipeline.http.crawl_source') as crawl, patch('core.pipeline.enrich_article') as enrich:
            self.assertEqual(run_source(spec, to_db=False, should_stop=lambda: True), [])
        crawl.assert_not_called()
        enrich.assert_not_called()

    def test_finishes_current_article_and_checkpoints_it_before_stopping(self):
        spec = SourceSpec(key='test', name='Test', categories={'World': ['https://example.com/world']},
                          feeds={'World': ['https://example.com/rss']}, target_per_category=5)
        feed = [{'url': f'https://example.com/story-{n}', 'topic': 'World'} for n in range(5)]
        stopped = False
        records = []
        def enrich(item, _spec):
            nonlocal stopped
            stopped = True  # the deadline passes DURING this article's work
            return {'id': 'accepted', 'canonical_url': item['url']}
        with patch('core.pipeline.http.crawl_feed', return_value=feed), patch('core.pipeline.http.crawl_source') as crawl, \
                patch('core.pipeline.enrich_article', side_effect=enrich) as extract:
            result = run_source(spec, to_db=False, should_stop=lambda: stopped, on_record=records.append)
        self.assertEqual(result, records)
        self.assertEqual([row['id'] for row in records], ['accepted'])
        extract.assert_called_once()
        crawl.assert_not_called()

    def test_budget_stop_finishes_with_honest_partial_coverage_not_failure(self):
        spec = SourceSpec(key='test', name='Test', categories={'World': ['https://example.com/world']}, target_per_category=20)
        args = SimpleNamespace(refresh_existing=False, target=20, report_path=None, stop_at=datetime.now(timezone.utc)+timedelta(hours=1))
        stopped = False
        def source(_spec, **kwargs):
            nonlocal stopped
            row = {'id': 'accepted', 'source': {'id': 'test'}, 'topic': 'World', 'sentiment': {'type': 'neutral'}}
            kwargs['on_record'](row)
            stopped = True
            return [row]
        report = {}
        with patch.object(run_all, 'all_specs', return_value=[spec]), patch.object(run_all, 'run_source', side_effect=source), \
                patch.object(run_all, 'stop_requested', side_effect=lambda _deadline: stopped):
            run_all.scrape(args, False, report, None)
        self.assertEqual(report['status'], 'partial')
        self.assertEqual(report['errors'], 0)
        self.assertEqual(report['articleIds'], ['accepted'])
        self.assertEqual(report['counts']['deficit_test_World'], 19)
        self.assertEqual(report['stopReason'], 'time_budget')

    def test_expired_cli_cutoff_is_rejected_without_touching_database(self):
        with patch('sys.argv', ['run_all.py', '--no-db', '--stop-at', '2000-01-01T00:00:00Z']), \
                patch.object(run_all, 'execute') as execute:
            with self.assertRaises(SystemExit) as result:
                run_all.main()
        self.assertEqual(result.exception.code, 2)
        execute.assert_not_called()
