"""Export public discovery URLs from the scraper specs, without loading NLP or scraping.
Run after editing a source spec: python ops/export-source-catalog.py
"""
import json
import re
import runpy
import sys
import types
from datetime import datetime, timezone, date
from pathlib import Path
from urllib.parse import urlparse, parse_qs

ROOT = Path(__file__).resolve().parents[1]
stub = types.ModuleType('core.pipeline')
stub.SourceSpec = lambda **kwargs: types.SimpleNamespace(**kwargs)
stub.run_source = lambda *_: None
sys.modules['core.pipeline'] = stub
now = datetime.now(timezone.utc)
catalog = []
for key in ['aljazeera', 'bbc', 'cnn', 'yahoo_tw']:
    spec = runpy.run_path(str(ROOT / 'scraper' / 'sources' / f'scraper_{key}.py'))['SPEC']
    entries = {}
    for field, kind in [('categories', 'Section page'), ('feeds', 'Category feed / sitemap'), ('routed_feeds', 'Shared feed / sitemap')]:
        for category, urls in getattr(spec, field, {}).items():
            for url in urls:
                if (url, kind) not in entries:
                    entries[url, kind] = {'url': url, 'kind': kind, 'categories': [], 'daysAgo': None, 'monthsAgo': None}
                entries[url, kind]['categories'].append(category)
    for row in entries.values():
        row['categories'] = sorted(set(row['categories']))
        parsed = urlparse(row['url'])
        params = parse_qs(parsed.query)
        if key == 'aljazeera' and all(k in params for k in ('yyyy', 'mm', 'dd')):
            stamp = date(int(params['yyyy'][0]), int(params['mm'][0]), int(params['dd'][0]))
            row['daysAgo'] = (now.date() - stamp).days
            row['url'] = 'https://www.aljazeera.com/sitemap.xml?yyyy={year}&mm={month}&dd={day}'
        match = re.search(r'/(\d{4})/(\d{2})\.xml$', row['url'])
        if key == 'cnn' and match:
            row['monthsAgo'] = (now.year - int(match[1])) * 12 + now.month - int(match[2])
            row['url'] = row['url'][:match.start()] + '/{year}/{month}.xml'
    catalog.append({'id': key, 'name': 'Yahoo Taiwan' if key == 'yahoo_tw' else spec.name, 'language': spec.language, 'entries': list(entries.values())})
target = ROOT / 'client/src/app/data/sourceCatalog.json'
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'Exported {sum(len(source["entries"]) for source in catalog)} discovery entries from {len(catalog)} source specs.')
