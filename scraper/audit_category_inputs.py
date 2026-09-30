"""Read-only extraction/classifier diagnostic. No DB writes or hosted AI calls."""
import json
from unittest.mock import patch
from core import nlp, config
from core.pipeline import enrich_article
from sources.scraper_bbc import SPEC

DESCRIPTIONS = {
    'Sport': 'sports, athletes and sporting competitions',
    'Health': 'health, medicine, diseases and healthcare',
    'Business': 'business, the economy, finance and companies',
    'World': 'international affairs, war, conflict and society',
    'Politics': 'politics, elections, government and legislation',
    'Lifestyle': 'entertainment, arts, culture, travel and lifestyle',
    'Science': 'science, technology and scientific research',
    'Climate': 'climate, the environment, conservation and extreme weather',
}

def inspect(items):
    item = items[0]
    text = item['title_hint'] + '\n' + item['content_hint'][:900]
    old = nlp._classifier()(text, candidate_labels=list(config.CATEGORY_LABELS), multi_label=False, hypothesis_template='This news is about {}.')
    new = nlp._classifier()(text, candidate_labels=list(DESCRIPTIONS.values()), multi_label=False, hypothesis_template='The main topic of this article is {}.')
    print(json.dumps({'expected': item['topic'], 'title': item['title_hint'], 'excerpt': item['content_hint'][:240],
                      'old': dict(zip(old['labels'], old['scores'])), 'new': dict(zip(new['labels'], new['scores']))}, ensure_ascii=False))
    return []  # stop before sentiment/summary/storage, regardless of prediction

if __name__ == '__main__':
    with patch.object(nlp, 'zero_shot_filter', side_effect=inspect):
        for topic, url in [('Business', 'https://www.bbc.co.uk/news/articles/cqp80p78mxx5o'),
                           ('Business', 'https://www.bbc.co.uk/news/articles/c9qxnyengdjo'),
                           ('Science', 'https://www.bbc.co.uk/news/articles/cqlykr2vrv04o')]:
            enrich_article({'url': url, 'topic': topic}, SPEC)
