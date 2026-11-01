"""CNN (edition.cnn.com) — English.

CNN's RSS feeds (rss.cnn.com) have been dead for years: every entry is stale.
What does work is the per-section *article sitemap*, one file per section per
month (``/sitemap/article/<section>/<yyyy>/<mm>.xml``), listing every story with
its date. ``feeds`` uses those: a pool of dozens to hundreds of dated, correctly
sectioned stories per category instead of the 20-30 links a section page shows.
Section index pages stay as the fallback.
"""
from __future__ import annotations

import os
import sys
from datetime import datetime, timezone

# Allow running this module directly as a script.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.pipeline import SourceSpec, run_source  # noqa: E402


def article_sitemaps(section: str, now: datetime | None = None) -> list[str]:
    """This month's and last month's sitemap: the 30-day window spans both."""
    now = now or datetime.now(timezone.utc)
    year, month = now.year, now.month
    previous = (year - 1, 12) if month == 1 else (year, month - 1)
    return [f'https://www.cnn.com/sitemap/article/{section}/{y}/{m:02d}.xml' for y, m in ((year, month), previous)]


def _sitemaps(*sections: str) -> list[str]:
    return [url for section in sections for url in article_sitemaps(section)]


SPEC = SourceSpec(
    key="cnn",
    name="CNN",
    language="en",
    content_selectors=['.article__content', '.article__main'],
    categories={
        "Sport":     ["https://edition.cnn.com/sport", "https://edition.cnn.com/sport/football", "https://edition.cnn.com/sport/tennis", "https://edition.cnn.com/sport/golf", "https://edition.cnn.com/sport/olympics", "https://edition.cnn.com/sport/nfl", "https://edition.cnn.com/sport/nba"],
        "Health":    ["https://edition.cnn.com/health"],
        "Business":  ["https://edition.cnn.com/business", "https://edition.cnn.com/business/tech", "https://edition.cnn.com/business/economy", "https://edition.cnn.com/business/media", "https://edition.cnn.com/business/investing", "https://edition.cnn.com/markets"],
        "World":     ["https://edition.cnn.com/world", "https://edition.cnn.com/world/europe", "https://edition.cnn.com/world/asia", "https://edition.cnn.com/world/middle-east", "https://edition.cnn.com/world/africa", "https://edition.cnn.com/world/americas", "https://edition.cnn.com/world/china", "https://edition.cnn.com/world/uk", "https://edition.cnn.com/us"],
        "Politics":  ["https://edition.cnn.com/politics", "https://edition.cnn.com/politics/supreme-court", "https://edition.cnn.com/politics/congress", "https://edition.cnn.com/politics/fact-check"],
        "Lifestyle": ["https://edition.cnn.com/entertainment", "https://edition.cnn.com/style", "https://edition.cnn.com/travel", "https://edition.cnn.com/style/fashion", "https://edition.cnn.com/style/arts", "https://edition.cnn.com/entertainment/movies"],
        "Science":   ["https://edition.cnn.com/science", "https://edition.cnn.com/science/space", "https://edition.cnn.com/science/life", "https://edition.cnn.com/tech"],
        "Climate":   ["https://edition.cnn.com/climate", "https://edition.cnn.com/climate/solutions"],
    },
    feeds={
        "Sport":     _sitemaps('sport'),
        "Health":    _sitemaps('health'),
        "Business":  _sitemaps('business'),
        "World":     _sitemaps('world', 'us'),
        "Politics":  _sitemaps('politics'),
        "Lifestyle": _sitemaps('entertainment', 'style', 'travel'),
        "Science":   _sitemaps('science'),
        "Climate":   _sitemaps('climate'),
    },
    # CNN files tech, AI, space and extreme-weather stories under business,
    # world and us; offer them to the category they look like.
    routed_feeds={
        "Health":  _sitemaps('science', 'us'),
        "Science": _sitemaps('business', 'world'),
        "Climate": _sitemaps('science', 'world', 'us', 'business'),
    },
)

if __name__ == "__main__":
    run_source(SPEC)
