import unittest
from unittest.mock import patch
from core.pipeline import SourceSpec, run_source


class DiscoveryTests(unittest.TestCase):
    def test_small_batch_discovers_for_full_forty_article_quota(self):
        spec=SourceSpec(key='test',name='Test',categories={'Science':['https://example.com/science']},target_per_category=5)
        with patch('core.pipeline.http.crawl_source',return_value=[]) as crawl:
            run_source(spec,to_db=False,discovery_target=40)
        self.assertEqual(crawl.call_args.args[2],120)

    def test_bounded_pass_does_not_consume_next_pass_candidate(self):
        feed=[{'url':f'https://example.com/story-{n}', 'title_hint':'Scientific discovery', 'topic':'Science'} for n in range(3)]
        attempts=set()
        with patch('core.pipeline.http.crawl_feed', return_value=feed), patch('core.pipeline.http.crawl_source', return_value=[]), patch('core.pipeline.enrich_article', return_value=None) as enrich:
            run_source(self.spec(),to_db=False,attempted_urls=attempts,candidate_limit=2)
            self.assertEqual(enrich.call_count,2)
            run_source(self.spec(),to_db=False,attempted_urls=attempts)
            self.assertEqual(enrich.call_count,3)

    def spec(self):
        return SourceSpec(key='test', name='Test', categories={'Science':['https://example.com/science']}, feeds={'Science':['https://example.com/rss']}, target_per_category=1)

    def test_large_rejected_feed_does_not_suppress_section_fallback(self):
        feed=[{'url':f'https://example.com/wrong-{n}', 'title_hint':'Wrong topic', 'topic':'Science'} for n in range(30)]
        section=[{'url':'https://example.com/science-story', 'title_hint':'Scientific discovery', 'topic':'Science'}]
        def enrich(item, spec):
            if 'wrong-' in item['url']:
                item['rejection']='category_mismatch'
                return None
            return {'canonical_url':item['url'], 'id':'verified'}
        with patch('core.pipeline.http.crawl_feed', return_value=feed), patch('core.pipeline.http.crawl_source', return_value=section) as crawl, patch('core.pipeline.enrich_article', side_effect=enrich):
            stats={'errors':0}
            rows=run_source(self.spec(), to_db=False, stats=stats)
        self.assertEqual(len(rows),1)
        self.assertEqual(stats['deficit_test_Science'],0)
        crawl.assert_called_once()

    def test_full_feed_quota_avoids_unnecessary_section_crawl(self):
        feed=[{'url':'https://example.com/fresh', 'title_hint':'Scientific discovery', 'topic':'Science'}]
        with patch('core.pipeline.http.crawl_feed', return_value=feed), patch('core.pipeline.http.crawl_source') as crawl, patch('core.pipeline.enrich_article', return_value={'canonical_url':feed[0]['url'], 'id':'fresh'}):
            self.assertEqual(len(run_source(self.spec(), to_db=False)),1)
        crawl.assert_not_called()

    def test_feed_and_section_repeated_url_is_only_enriched_once(self):
        item={'url':'https://example.com/repeated', 'title_hint':'Scientific discovery', 'topic':'Science'}
        with patch('core.pipeline.http.crawl_feed', return_value=[item]), patch('core.pipeline.http.crawl_source', return_value=[item]), patch('core.pipeline.enrich_article', return_value=None) as enrich:
            self.assertEqual(run_source(self.spec(), to_db=False),[])
        enrich.assert_called_once()
