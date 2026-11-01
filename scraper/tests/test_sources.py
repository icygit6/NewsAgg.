import re
import unittest
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

from core import http, routing
from core.pipeline import SourceSpec, run_source
from sources import REGISTRY
from sources.scraper_aljazeera import daily_sitemaps
from sources.scraper_cnn import article_sitemaps

CATEGORIES = {'Sport', 'Health', 'Business', 'World', 'Politics', 'Lifestyle', 'Science', 'Climate'}


def response(body: str):
    reply = MagicMock()
    reply.content = body.encode('utf-8')
    return reply


# Shaped like https://www.cnn.com/sitemap/article/<section>/<yyyy>/<mm>.xml: every
# <url> carries an <image:image><image:loc> that must not replace the page <loc>.
CNN_SITEMAP = '''<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url><loc>https://www.cnn.com/2026/10/01/health/older-story</loc><lastmod>2026-10-01T08:00:00+00:00</lastmod>
    <image:image><image:loc>https://media.cnn.com/api/v1/images/old.jpg</image:loc><image:title>Old</image:title></image:image></url>
  <url><loc>https://www.cnn.com/2026/10/20/health/newer-story</loc><lastmod>2026-10-20T08:00:00+00:00</lastmod>
    <image:image><image:loc>https://media.cnn.com/api/v1/images/new.jpg</image:loc><image:title>Photo caption</image:title></image:image></url>
  <url><loc>https://www.cnn.com/2026/10/21/health/newest-story</loc><lastmod>2026-10-21T08:00:00+00:00</lastmod></url>
  <url><loc>https://www.cnn.com/health/section-landing-page</loc><lastmod>2026-10-21T09:00:00+00:00</lastmod></url>
</urlset>'''

AJ_NEWS_SITEMAP = '''<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
  <url><loc>https://www.aljazeera.com/sports/2026/10/21/psg-injuries</loc><lastmod>2026-10-21T10:45:01+00:00</lastmod>
    <news:news><news:publication><news:name>Al Jazeera</news:name></news:publication>
      <news:publication_date>2026-10-21T10:45:01+00:00</news:publication_date><news:title>PSG star out injured</news:title></news:news></url>
  <url><loc>https://www.aljazeera.com/news/2026/10/21/flood-victims</loc><lastmod>2026-10-21T09:00:00+00:00</lastmod>
    <news:news><news:publication_date>2026-10-21T09:00:00+00:00</news:publication_date><news:title>Floods displace thousands</news:title></news:news></url>
  <url><loc>https://www.aljazeera.com/video/newsfeed/2026/10/21/protest-video</loc><lastmod>2026-10-21T08:00:00+00:00</lastmod>
    <news:news><news:title>Protest video</news:title></news:news></url>
</urlset>'''

# Shaped like https://www.aljazeera.com/sitemap.xml?yyyy=2026&mm=10&dd=20: dated
# by <lastmod> only (no news:title), and full of live blogs and videos.
AJ_DAILY_SITEMAP = '''<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.aljazeera.com/news/liveblog/2026/10/20/draft-3</loc><lastmod>2026-10-20T12:00:00+00:00</lastmod></url>
  <url><loc>https://www.aljazeera.com/video/newsfeed/2026/10/20/clip</loc><lastmod>2026-10-20T11:00:00+00:00</lastmod></url>
  <url><loc>https://www.aljazeera.com/news/2026/10/20/measles-outbreak-spreads-in-vaccine-gaps</loc><lastmod>2026-10-20T10:00:00+00:00</lastmod></url>
  <url><loc>https://www.aljazeera.com/sports/2026/10/20/league-leaders-win-again</loc><lastmod>2026-10-20T09:00:00+00:00</lastmod></url>
</urlset>'''

RSS = '''<?xml version="1.0"?><rss><channel>
  <item><title>Old</title><link>https://www.bbc.com/news/articles/c111aaaa</link><pubDate>Mon, 05 Oct 2026 08:00:00 GMT</pubDate></item>
  <item><title>New</title><link>https://www.bbc.com/news/articles/c222bbbb</link><pubDate>Tue, 20 Oct 2026 08:00:00 GMT</pubDate></item>
  <item><title>Arabic</title><link>https://www.bbc.com/arabic/articles/c333cccc</link><pubDate>Tue, 20 Oct 2026 09:00:00 GMT</pubDate></item>
</channel></rss>'''


class CrawlFeedTests(unittest.TestCase):
    def setUp(self):
        http._FEED_CACHE.clear()

    def crawl(self, body, url='https://example.test/feed.xml', base='https://www.cnn.com', **kwargs):
        with patch('core.http.get', return_value=response(body)):
            return http.crawl_feed(url, 'Health', kwargs.pop('cap', 120), base, **kwargs)

    def test_sitemap_page_loc_is_not_replaced_by_the_image_loc(self):
        urls = [row['url'] for row in self.crawl(CNN_SITEMAP)]
        self.assertEqual(urls, ['https://www.cnn.com/2026/10/21/health/newest-story',
                                'https://www.cnn.com/2026/10/20/health/newer-story',
                                'https://www.cnn.com/2026/10/01/health/older-story'])
        self.assertFalse(any(url.endswith('.jpg') for url in urls))

    def test_sitemap_entries_are_newest_first_so_the_cap_keeps_the_freshest(self):
        urls = [row['url'] for row in self.crawl(CNN_SITEMAP, cap=2)]
        self.assertEqual([u.rsplit('/', 1)[-1] for u in urls], ['newest-story', 'newer-story'])

    def test_news_sitemap_supplies_title_and_publication_date(self):
        rows = self.crawl(AJ_NEWS_SITEMAP, base='https://www.aljazeera.com')
        self.assertEqual([r['title_hint'] for r in rows], ['PSG star out injured', 'Floods displace thousands'])
        self.assertEqual(rows[0]['published_hint'], '2026-10-21T10:45:01+00:00')
        self.assertTrue(all('/video/' not in r['url'] for r in rows), 'video pages are not articles')

    def test_daily_sitemap_without_titles_is_routed_by_the_url_slug(self):
        base = 'https://www.aljazeera.com'
        everything = self.crawl(AJ_DAILY_SITEMAP, base=base)
        self.assertEqual([r['url'].rsplit('/', 1)[-1] for r in everything],
                         ['measles-outbreak-spreads-in-vaccine-gaps', 'league-leaders-win-again'],
                         'live blogs and videos are not articles')
        self.assertEqual(everything[0]['published_hint'], '2026-10-20T10:00:00+00:00', 'dated by lastmod')
        health = self.crawl(AJ_DAILY_SITEMAP, base=base, match=routing.hint_for('Health'))
        self.assertEqual([r['url'].rsplit('/', 1)[-1] for r in health], ['measles-outbreak-spreads-in-vaccine-gaps'])
        sport = self.crawl(AJ_DAILY_SITEMAP, base=base, match=routing.hint_for('Sport'))
        self.assertEqual([r['url'].rsplit('/', 1)[-1] for r in sport], ['league-leaders-win-again'])

    def test_match_keeps_only_entries_that_look_like_the_category(self):
        rows = self.crawl(AJ_NEWS_SITEMAP, base='https://www.aljazeera.com', match=routing.hint_for('Climate'))
        self.assertEqual([r['title_hint'] for r in rows], ['Floods displace thousands'])
        rows = self.crawl(AJ_NEWS_SITEMAP, base='https://www.aljazeera.com', match=routing.hint_for('Sport'))
        self.assertEqual([r['title_hint'] for r in rows], ['PSG star out injured'])

    def test_scope_drops_other_language_sections_of_a_multilingual_feed(self):
        scope = re.compile(r'^https://www\.bbc\.com/news/')
        rows = self.crawl(RSS, base='https://www.bbc.com/news', scope=scope)
        self.assertEqual([r['title_hint'] for r in rows], ['New', 'Old'])
        self.assertEqual(len(self.crawl(RSS, base='https://www.bbc.com/news')), 3, 'without a scope the Arabic story passes')

    def test_rss_still_works_and_is_sorted_newest_first(self):
        rows = self.crawl(RSS, base='https://www.bbc.com/news')
        self.assertEqual([r['title_hint'] for r in rows][:2], ['Arabic', 'New'])
        self.assertEqual(rows[0]['topic'], 'Health')

    def test_a_feed_is_fetched_once_across_quota_rounds(self):
        with patch('core.http.get', return_value=response(RSS)) as get:
            for _ in range(5):
                http.crawl_feed('https://example.test/rss.xml', 'World', 40, 'https://www.bbc.com/news')
        get.assert_called_once()

    def test_unreachable_or_malformed_feeds_yield_nothing(self):
        with patch('core.http.get', return_value=None):
            self.assertEqual(http.crawl_feed('https://example.test/a.xml', 'World', 40, 'https://www.cnn.com'), [])
        http._FEED_CACHE.clear()
        self.assertEqual(self.crawl('<not xml'), [])


class RoutingTests(unittest.TestCase):
    def test_every_category_has_a_hint_and_hints_are_not_shared(self):
        self.assertEqual(set(routing.CATEGORY_HINTS), CATEGORIES)

    def test_typical_headlines_route_to_their_category(self):
        cases = {
            'Health': 'NHS warns of measles outbreak as vaccine uptake falls',
            'Climate': 'Wildfires and heatwaves push emissions to a record',
            'Science': 'NASA telescope finds asteroid headed past Mars',
            'Business': 'Bank of England holds interest rates as inflation eases',
            'Politics': 'Senate vote on the budget bill splits Republicans',
            'Lifestyle': 'Netflix series tops the box office at the film festival',
            'Sport': 'Premier League title race tightens after derby',
        }
        for category, headline in cases.items():
            self.assertTrue(routing.hint_for(category).search(headline), (category, headline))

    def test_a_hint_does_not_claim_an_unrelated_headline(self):
        self.assertIsNone(routing.hint_for('Climate').search('Netflix series tops the box office'))
        self.assertIsNone(routing.hint_for('Sport').search('Senate vote on the budget bill'))


class SourceSpecTests(unittest.TestCase):
    def test_the_three_english_sources_cover_all_eight_categories(self):
        for key in ('bbc', 'cnn', 'aljazeera'):
            self.assertEqual(set(REGISTRY[key].categories), CATEGORIES, key)

    def test_every_category_has_a_real_pool_not_a_single_page(self):
        for key in ('bbc', 'cnn', 'aljazeera'):
            spec = REGISTRY[key]
            for category in CATEGORIES:
                sources = (len(spec.categories[category]) + len(spec.feeds.get(category, []))
                           + len(spec.routed_feeds.get(category, [])))
                self.assertGreaterEqual(sources, 3, f'{key}/{category} depends on too few URLs')

    def test_routed_feeds_only_name_known_categories(self):
        for spec in REGISTRY.values():
            self.assertLessEqual(set(spec.routed_feeds), CATEGORIES)
            self.assertLessEqual(set(spec.feeds), CATEGORIES)

    def test_every_category_has_at_least_one_page_for_the_fallback_crawl(self):
        for key in ('bbc', 'cnn', 'aljazeera'):
            for category, pages in REGISTRY[key].categories.items():
                self.assertTrue(pages and all(p.startswith('https://') for p in pages), (key, category))

    def test_cnn_sitemaps_cover_this_month_and_last(self):
        self.assertEqual(article_sitemaps('health', datetime(2026, 10, 21, tzinfo=timezone.utc)), [
            'https://www.cnn.com/sitemap/article/health/2026/10.xml',
            'https://www.cnn.com/sitemap/article/health/2026/09.xml'])

    def test_cnn_sitemaps_roll_back_over_the_new_year(self):
        self.assertEqual(article_sitemaps('world', datetime(2027, 1, 3, tzinfo=timezone.utc)), [
            'https://www.cnn.com/sitemap/article/world/2027/01.xml',
            'https://www.cnn.com/sitemap/article/world/2026/12.xml'])

    def test_aljazeera_reads_two_weeks_of_daily_sitemaps(self):
        urls = daily_sitemaps(datetime(2026, 3, 2, tzinfo=timezone.utc))
        self.assertEqual(len(urls), 14)
        self.assertEqual(urls[0], 'https://www.aljazeera.com/sitemap.xml?yyyy=2026&mm=03&dd=02')
        self.assertEqual(urls[2], 'https://www.aljazeera.com/sitemap.xml?yyyy=2026&mm=02&dd=28', 'rolls back over the month end')
        self.assertEqual(len(set(urls)), 14)
        for category in CATEGORIES:
            self.assertTrue(set(daily_sitemaps()) <= set(REGISTRY['aljazeera'].routed_feeds[category]), category)

    def test_bbc_scope_accepts_english_sections_and_rejects_other_languages(self):
        scope = REGISTRY['bbc'].feed_scope
        self.assertTrue(scope.search('https://www.bbc.com/news/articles/c1234abcd'))
        self.assertTrue(scope.search('https://www.bbc.com/sport/football/articles/c1234abcd'))
        self.assertFalse(scope.search('https://www.bbc.com/arabic/articles/c1234abcd'))
        self.assertFalse(scope.search('https://www.bbc.com/hindi/articles/c1234abcd'))


class PipelineRoutingTests(unittest.TestCase):
    def test_routed_feeds_are_filtered_by_the_category_hint_and_plain_feeds_are_not(self):
        spec = SourceSpec(key='t', name='T', categories={'Climate': ['https://example.test/climate']},
                          feeds={'Climate': ['https://example.test/plain.xml']},
                          routed_feeds={'Climate': ['https://example.test/firehose.xml']},
                          feed_scope=re.compile('^https://example'), target_per_category=1)
        calls = []
        def fake_feed(url, category, cap, base, **kwargs):
            calls.append((url, kwargs.get('match'), kwargs.get('scope')))
            return []
        with patch('core.pipeline.http.crawl_feed', side_effect=fake_feed), \
             patch('core.pipeline.http.crawl_source', return_value=[]):
            run_source(spec, to_db=False)
        by_url = {url: (match, scope) for url, match, scope in calls}
        self.assertIsNone(by_url['https://example.test/plain.xml'][0])
        self.assertIs(by_url['https://example.test/firehose.xml'][0], routing.hint_for('Climate'))
        self.assertIsNotNone(by_url['https://example.test/plain.xml'][1], 'scope applies to every feed')

    def test_feed_listing_uses_the_generous_cap_not_the_article_fetch_budget(self):
        spec = SourceSpec(key='t', name='T', categories={'Science': ['https://example.test/s']},
                          feeds={'Science': ['https://example.test/f.xml']}, target_per_category=1)
        with patch('core.pipeline.http.crawl_feed', return_value=[]) as feed, \
             patch('core.pipeline.http.crawl_source', return_value=[]):
            run_source(spec, to_db=False)
        self.assertGreaterEqual(feed.call_args.args[2], 120)


if __name__ == '__main__':
    unittest.main()
