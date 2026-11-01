"""Al Jazeera (aljazeera.com) — English.

Al Jazeera shows only 3-9 stories on any one section or tag page, which is why
this source used to contribute so few articles. Two changes:

* every category now crawls a dozen or so section and tag pages, so their union
  is a real pool (probed live; each returned fresh, dated stories);
* its Google-News sitemap, RSS feed and one sitemap per day (~60 stories a day,
  all dated) list far more than any page shows, but with no section, so they
  are ``routed_feeds``: offered to a category only when the title or URL slug
  looks like it (core.routing), then verified by the classifier.

Politics and Lifestyle have no section of their own on aljazeera.com, but
their tag pages do carry them, so all eight categories are covered.
"""
from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.pipeline import SourceSpec, run_source  # noqa: E402

BASE = 'https://www.aljazeera.com'


def _pages(*paths: str) -> list[str]:
    return [BASE + path for path in paths]


# The runner takes the newest unseen stories first, so two weeks of daily
# sitemaps is ample; reaching further back would only add requests.
DAILY_SITEMAP_DAYS = 14


def daily_sitemaps(now: datetime | None = None, days: int = DAILY_SITEMAP_DAYS) -> list[str]:
    """``/sitemap.xml?yyyy=&mm=&dd=`` for today and the days before it."""
    now = now or datetime.now(timezone.utc)
    return [f'{BASE}/sitemap.xml?yyyy={d.year}&mm={d.month:02d}&dd={d.day:02d}'
            for d in (now - timedelta(days=n) for n in range(days))]


FIREHOSES = [f'{BASE}/news-sitemap.xml', f'{BASE}/xml/rss/all.xml', *daily_sitemaps()]

SPEC = SourceSpec(
    key="aljazeera",
    name="Al Jazeera",
    language="en",
    content_selectors=['.wysiwyg'],
    categories={
        "Sport":     _pages('/sports/', '/tag/football/', '/tag/cricket/'),
        "Health":    _pages('/tag/health/', '/tag/mental-health/'),
        "Business":  _pages('/economy/', '/tag/business-and-economy/', '/tag/energy/', '/business/'),
        "Politics":  _pages('/tag/politics/', '/tag/elections/', '/tag/donald-trump/', '/tag/european-union/', '/tag/government/', '/tag/israel-palestine-conflict/'),
        "Lifestyle": _pages('/tag/arts-and-culture/', '/tag/food/', '/tag/music/', '/tag/entertainment/', '/tag/television/', '/tag/social-media/'),
        "Science":   _pages('/tag/science-and-technology/', '/tag/space/', '/tag/internet/', '/tag/cybersecurity/', '/tag/technology/'),
        "Climate":   _pages('/climate-crisis/', '/tag/climate-crisis/', '/tag/environment/', '/tag/wildlife/', '/tag/renewable-energy/', '/tag/floods/'),
        # Last on purpose: the catch-all regions go after the specific topics.
        "World":     _pages('/news/', '/middle-east/', '/africa/', '/asia/', '/us-canada/', '/latin-america/', '/europe/', '/asia-pacific/', '/tag/conflict/', '/tag/human-rights/', '/tag/united-nations/', '/tag/migration/', '/features/'),
    },
    routed_feeds={category: FIREHOSES for category in ('Sport', 'Health', 'Business', 'Politics', 'Lifestyle', 'Science', 'Climate', 'World')},
)

if __name__ == "__main__":
    run_source(SPEC)
