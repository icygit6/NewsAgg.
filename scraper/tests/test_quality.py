import unittest
from unittest.mock import patch
from datetime import datetime, timezone, timedelta
from bs4 import BeautifulSoup
from core import quality, summarizer, extract, semantic, http

class ArticleQualityTests(unittest.TestCase):
    def test_wrapped_list_items_preserve_source_text_without_empty_list(self):
        body = 'The researchers measured the effect using controlled observations. ' * 7
        soup = BeautifulSoup(f'<article><p>{body}</p><ul><div><li>A measured finding from the original report.</li></div></ul></article>', 'html.parser')
        text, blocks = quality.structured_body(soup, ['article'])
        self.assertIn('A measured finding from the original report.', text)
        self.assertEqual(blocks[-1], {'type':'paragraph', 'text':'A measured finding from the original report.'})
        self.assertFalse(any(b['type']=='list' and not b['items'] for b in blocks))
        self.assertEqual(text, '\n\n'.join(b['text'] for b in blocks))

    def test_blank_list_does_not_create_invalid_block(self):
        body = 'The original report documents independently checked measurements. ' * 7
        soup = BeautifulSoup(f'<article><p>{body}</p><ul><li> </li></ul></article>', 'html.parser')
        _, blocks = quality.structured_body(soup, ['article'])
        self.assertEqual(len(blocks), 1)
        self.assertEqual(blocks[0]['type'], 'paragraph')

    def test_summary_input_excludes_caption_and_heading_but_keeps_prose(self):
        blocks=[{'type':'heading','text':'Heading'}, {'type':'caption','text':'Getty Images photograph'},
                {'type':'paragraph','text':'This is the actual reported evidence.'}, {'type':'list','items':['Reported fact one','Reported fact two']}]
        text=quality.summary_body(blocks)
        self.assertNotIn('Getty',text);self.assertNotIn('Heading',text)
        self.assertIn('actual reported evidence',text);self.assertIn('Reported fact two',text)

    def test_images_do_not_leak_from_yahoo_next_story_or_recommendations(self):
        soup=BeautifulSoup('<div class="caas-body"><figure><img src="/main.jpg"></figure><aside><figure><img src="/related.jpg"></figure></aside></div><div class="caas-body"><figure><img src="/next.jpg"></figure></div>', 'html.parser')
        images=quality.image_candidates(soup,'https://example.com/story',{},top_image='https://example.com/next.jpg')
        self.assertEqual([image['url'] for image in images],['https://example.com/main.jpg'])

    def test_html_without_header_charset_uses_html_encoding(self):
        import requests
        response = requests.Response()
        response._content = '<meta charset="utf-8"><p>£300m — 台灣</p>'.encode('utf-8')
        response.headers['Content-Type'] = 'text/html'
        response.encoding = 'ISO-8859-1'
        self.assertIn('£300m — 台灣', http.html_text(response))

    def test_bbc_caption_children_and_promos_are_not_duplicated(self):
        body = 'The report describes evidence from the current football season. ' * 7
        soup = BeautifulSoup(f'<article><figcaption><span>Image caption, </span><p>Managers on the pitch</p></figcaption><p>{body}</p><div data-block="promoList"><ul><li>Follow your club</li></ul></div></article>', 'html.parser')
        text, blocks = quality.structured_body(soup, ['article'])
        self.assertEqual(text.count('Managers on the pitch'), 1)
        self.assertEqual([b['type'] for b in blocks], ['caption', 'paragraph'])
        self.assertNotIn('Follow your club', text)

    def test_dates_reject_old_unknown_future(self):
        now = datetime(2026, 9, 19, tzinfo=timezone.utc)
        self.assertEqual(quality.date_rejection(now-timedelta(days=31), now=now), 'old_article')
        self.assertEqual(quality.date_rejection(None, now=now), 'unknown_date')
        self.assertEqual(quality.date_rejection(now+timedelta(days=1), now=now), 'future_date')
        self.assertIsNone(quality.date_rejection(now-timedelta(days=1), now=now))

    def test_original_publication_wins_over_recent_update(self):
        soup = BeautifulSoup('<time datetime="2026-09-19">Updated today</time>', 'html.parser')
        dt, origin = quality.publication_date(soup, {'jsonld_datePublished':'2011-04-26','jsonld_dateModified':'2026-09-19'}, {}, None, 'https://example.com')
        self.assertEqual(dt.year, 2011)
        self.assertEqual(origin, 'jsonld')

    def test_structure_and_related_content(self):
        body = 'This article describes the scientific research and its important conclusions. ' * 5
        soup = BeautifulSoup(f'<article><h2>Results</h2><p>{body}</p><ul><li>First result</li><li>Second result</li></ul><aside><p>BAD RECOMMENDATION</p></aside><blockquote>Quoted evidence</blockquote></article>', 'html.parser')
        text, blocks = quality.structured_body(soup, [])
        self.assertEqual([b['type'] for b in blocks], ['heading','paragraph','list','quote'])
        self.assertNotIn('BAD RECOMMENDATION', text)
        self.assertEqual(blocks[2]['items'], ['First result','Second result'])

    def test_jsonld_graph(self):
        soup = BeautifulSoup('<script type="application/ld+json">{"@graph":[{"@type":"NewsArticle","headline":"Article","datePublished":"2026-09-19","image":[{"url":"https://example.com/image.jpg"}]}]}</script>', 'html.parser')
        result = extract.jsonld_article(extract.extract_jsonld(soup))
        self.assertEqual(result['jsonld_headline'], 'Article')
        self.assertEqual(result['jsonld_image'], 'https://example.com/image.jpg')

    def test_yahoo_does_not_merge_infinite_scroll_stories(self):
        body = 'The primary article contains verified reporting on scientific research. ' * 6
        soup = BeautifulSoup(f'<div class="caas-body"><p>{body}</p></div><div class="caas-body"><p>UNRELATED STORY</p></div>', 'html.parser')
        text, _ = quality.structured_body(soup, ['.caas-body'])
        self.assertIn('scientific research', text)
        self.assertNotIn('UNRELATED STORY', text)

    def test_aljazeera_embedded_recommendations_are_not_article_body(self):
        body = 'The company announced a change in its financial leadership. ' * 7
        soup = BeautifulSoup(f'<div class="wysiwyg"><p>{body}</p><section class="more-on"><h2>Recommended Stories</h2><ul><li>BAD SPORTS LINK</li></ul></section><p>The company confirmed its succession plan.</p></div>', 'html.parser')
        text, _ = quality.structured_body(soup, ['.wysiwyg'])
        self.assertNotIn('BAD SPORTS LINK', text)
        self.assertNotIn('Recommended Stories', text)

    def test_image_query_parameters_survive(self):
        soup = BeautifulSoup('<meta property="og:image" content="https://example.com/photo?w=1200&amp;sig=abc">', 'html.parser')
        self.assertEqual(quality.image_candidates(soup, 'https://example.com/article', {})[0]['url'], 'https://example.com/photo?w=1200&sig=abc')

    def test_bbc_resize_variants_are_one_image(self):
        primary = 'https://ichef.bbci.co.uk/news/1024/cpsprodpb/abc/photo.jpg'
        resized = 'https://ichef.bbci.co.uk/ace/standard/976/cpsprodpb/abc/photo.jpg'
        soup = BeautifulSoup(f'<meta property="og:image" content="{primary}"><article><figure><img src="{resized}"></figure></article>', 'html.parser')
        self.assertEqual(len(quality.image_candidates(soup, 'https://www.bbc.com/news/article', {})), 1)

    @patch('core.semantic.embed', return_value=None)
    def test_summary_preserves_decimals_and_uses_end(self, _):
        text = '\n\n'.join(['The pension rose by 2.5% following a national review of public finances.', 'The pension policy was discussed by parliament with detailed estimates.', 'Analysts reviewed the pension policy and the effects on future funding.', 'The final decision increased the retirement age to 67 after a lengthy review.'])
        result = summarizer.summarize(text, 'en', 'Pension policy and retirement age')
        self.assertIn('2.5%', result['text'])
        self.assertIn('age to 67', result['text'])
        self.assertTrue(all(sentence in text for sentence in result['evidence']))

    def test_chinese_sentences_and_no_fabrication(self):
        text = '政府今天公布新的環境保護政策，計畫在未來五年降低工業碳排放。研究團隊表示，政策需要持續監測並公開每一年的實際成果。'
        with patch('core.semantic.embed', return_value=None):
            result = summarizer.summarize(text, 'zh-TW')
        self.assertIsNotNone(result['text'])
        self.assertTrue(all(s in text for s in result['evidence']))

    def test_sentence_boundaries_preserve_doctors_and_quoted_sentences(self):
        text = 'Dr. Alan Smith reviewed the entire research paper. He said, “These findings need further study.” The final report will be published tomorrow.'
        rows = summarizer.sentences(text)
        self.assertEqual(len(rows), 3)
        self.assertTrue(rows[0].startswith('Dr. Alan'))
        self.assertTrue(rows[1].endswith('study.”'))

if __name__ == '__main__':
    unittest.main()
