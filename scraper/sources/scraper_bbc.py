"""BBC (bbc.com) — English.

Discovery has three layers, newest-first and de-duplicated by the pipeline:

* ``feeds``        per-section RSS, trusted for their category;
* ``routed_feeds`` firehoses (top stories, UK, the news sitemaps) offered to a
                   category only when an entry looks relevant (core.routing);
* ``categories``   section index pages, crawled only if the feeds fall short.

Every feed below was probed live and returned dated entries inside the 30-day
admission window. BBC's worklife RSS (stale) and the innovation / future-planet
RSS (404) were left out.
"""
from __future__ import annotations

import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.pipeline import SourceSpec, run_source  # noqa: E402

NEWS = 'https://feeds.bbci.co.uk/news/{}/rss.xml'
SPORT = 'https://feeds.bbci.co.uk/sport/{}/rss.xml'
TOP_STORIES = 'https://feeds.bbci.co.uk/news/rss.xml'
UK = NEWS.format('uk')
SCIENCE_ENVIRONMENT = NEWS.format('science_and_environment')
FUTURE = 'https://www.bbc.com/future/feed.rss'
# BBC's news sitemaps are ~1,000 entries each, a third of them non-English;
# feed_scope below keeps only the English sections.
NEWS_SITEMAPS = [f'https://www.bbc.com/sitemaps/https-sitemap-com-news-{n}.xml' for n in (1, 2, 3)]
FIREHOSES = [TOP_STORIES, UK, *NEWS_SITEMAPS]

SPEC = SourceSpec(
    key="bbc",
    name="BBC",
    language="en",
    categories={
        "Sport":     ["https://www.bbc.com/sport", "https://www.bbc.com/sport/football", "https://www.bbc.com/sport/tennis"],
        "Health":    ["https://www.bbc.com/news/health"],
        "Business":  ["https://www.bbc.com/business", "https://www.bbc.com/news/business"],
        "World":     ["https://www.bbc.com/news/world", "https://www.bbc.com/news/world/asia", "https://www.bbc.com/news/world/us_and_canada"],
        "Politics":  ["https://www.bbc.com/news/politics"],
        "Lifestyle": ["https://www.bbc.com/arts", "https://www.bbc.com/travel", "https://www.bbc.com/culture"],
        "Science":   ["https://www.bbc.com/technology", "https://www.bbc.com/innovation", "https://www.bbc.com/news/science_and_environment"],
        "Climate":   ["https://www.bbc.com/future-planet", "https://www.bbc.com/news/science_and_environment"],
    },
    feeds={
        "Sport":     ['https://feeds.bbci.co.uk/sport/rss.xml', *(SPORT.format(s) for s in ('football', 'tennis', 'cricket', 'formula1', 'rugby-union', 'golf', 'cycling'))],
        "Health":    [NEWS.format('health')],
        "Business":  [NEWS.format('business')],
        "World":     [NEWS.format('world'), *(NEWS.format(f'world/{region}') for region in ('asia', 'europe', 'us_and_canada', 'middle_east', 'africa', 'latin_america'))],
        "Politics":  [NEWS.format('politics')],
        "Lifestyle": [NEWS.format('entertainment_and_arts'), 'https://www.bbc.com/travel/feed.rss', 'https://www.bbc.com/culture/feed.rss'],
        "Science":   [NEWS.format('technology'), SCIENCE_ENVIRONMENT, FUTURE],
        "Climate":   [SCIENCE_ENVIRONMENT],
    },
    routed_feeds={
        "Sport":     NEWS_SITEMAPS,
        "Health":    [*FIREHOSES, SCIENCE_ENVIRONMENT],
        "Business":  FIREHOSES,
        "Politics":  FIREHOSES,
        "Lifestyle": FIREHOSES,
        "Science":   FIREHOSES,
        "Climate":   [*FIREHOSES, FUTURE],
    },
    feed_scope=re.compile(r'^https://www\.bbc\.(?:com|co\.uk)/(?:news|sport|future|future-planet|travel|culture|worklife|innovation|arts)/'),
    content_selectors=['[data-component="text-block"]', 'article'],
)

if __name__ == "__main__":
    run_source(SPEC)
