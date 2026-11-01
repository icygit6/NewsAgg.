import io
import unittest
from unittest.mock import patch
from urllib.parse import quote
from bs4 import BeautifulSoup
from PIL import Image
from core import quality

class PrimaryStoryTests(unittest.TestCase):
    def parse(self, html):
        return BeautifulSoup(html, 'html.parser')

    def test_short_article_never_replaced_by_fallback(self):
        soup=self.parse('<article><p>Short verified reporting.</p></article><p>Other story</p>')
        text,_=quality.structured_body(soup,['article'],'BAD LONG FALLBACK '*200)
        self.assertEqual(text,'Short verified reporting.')

    def test_missing_publisher_boundary_fails_closed(self):
        text,blocks=quality.structured_body(self.parse('<div>Unscoped content</div>'),['.caas-body'],'BAD '*300)
        self.assertEqual((text,blocks),('',[]))

    def test_yahoo_atoms_excludes_header_related_and_next_article(self):
        soup=self.parse('<article><header><p>Follow Yahoo</p></header><div class="atoms"><p>Actual story.</p><p>更多自由時報報導<a>Other story</a></p><p>【看原文連結】</p><img data-src="/actual.jpg"></div></article><article><div class="atoms"><p>Next story.</p><img src="/next.jpg"></div></article>')
        selectors=['.caas-body','article .atoms']
        self.assertEqual(quality.structured_body(soup,selectors)[0],'Actual story.')
        self.assertEqual([r['url'] for r in quality.image_candidates(soup,'https://example.com/a',{},selectors=selectors)],['https://example.com/actual.jpg'])

    def test_shared_boundaries_for_cnn_bbc_aljazeera(self):
        for selector,attr in [('.article__content','class="article__content"'),('[data-component="text-block"]','data-component="text-block"'),('.wysiwyg','class="wysiwyg"')]:
            with self.subTest(selector=selector):
                soup=self.parse(f'<article><div {attr}><p>Main story.</p><blockquote>Quote<aside>BAD NESTED</aside></blockquote><div data-testid="recommendations"><p>BAD</p><img src="/bad.jpg"></div><figure><img src="/main.jpg"></figure></div></article><article><div {attr}><p>BAD NEXT</p><img src="/next.jpg"></div></article>')
                text,_=quality.structured_body(soup,[selector])
                self.assertNotIn('BAD',text)
                self.assertIn('Quote',text)
                self.assertEqual([r['url'] for r in quality.image_candidates(soup,'https://example.com/a',{},selectors=[selector])],['https://example.com/main.jpg'])

    def test_pagewide_top_image_is_not_trusted(self):
        self.assertEqual(quality.image_candidates(self.parse('<div><img src="/other.jpg"></div>'),'https://example.com/a',{},'https://example.com/other.jpg'),[])

    def test_nested_story_metadata_is_not_a_photo_fallback(self):
        soup=self.parse('<html><head><meta property="og:image" content="/main.jpg"></head><body><article><aside><meta property="og:image" content="/other.jpg"></aside></article></body></html>')
        self.assertEqual([x['url'] for x in quality.image_candidates(soup,'https://example.com/a',{})],['https://example.com/main.jpg'])

    def test_contaminated_stream_rejected(self):
        self.assertEqual(quality.contamination_reason('News ・ 21 小時前 ・ 發表留言 Other ・ 3 小時前 ・ 2則留言'),'recommendation_stream')
        self.assertIsNone(quality.contamination_reason('The report was released 21 hours ago.'))

    def test_yahoo_original_fallback_is_restricted(self):
        prefix='https://s.yimg.com/lo/mysterio/api/hash/resize/'
        self.assertEqual(quality.original_yahoo_image(prefix+quote('https://media.zenfs.com/a.jpg?sig=x',safe='')),'https://media.zenfs.com/a.jpg?sig=x')
        for url in ['http://media.zenfs.com/a.jpg','https://evil.test/a.jpg','https://user@media.zenfs.com/a.jpg','https://media.zenfs.com:444/a.jpg']:
            self.assertIsNone(quality.original_yahoo_image(prefix+quote(url,safe='')))

    def test_validate_falls_back_to_same_asset(self):
        from requests import Response
        buff=io.BytesIO();Image.new('RGB',(600,400)).save(buff,format='JPEG')
        response=Response();response.status_code=200;response.headers['Content-Type']='image/jpeg'
        response._content=buff.getvalue();response._content_consumed=True
        original='https://media.zenfs.com/a.jpg'
        resized='https://s.yimg.com/lo/mysterio/api/hash/resize/'+quote(original,safe='')
        with patch('core.http.get',side_effect=[None,response]) as fetch:
            result=quality.validate_images([{'url':resized}])
        self.assertEqual(result[0]['url'],original)
        self.assertEqual(fetch.call_count,2)

    def test_original_publisher_requires_explicit_link_and_matching_headline(self):
        from requests import Response
        title='TPBL 海神狀元賀丹初登場夢想家只登錄雙洋將'
        soup=self.parse('<article><div class="atoms"><a href="https://sports.ltn.com.tw/news/a">【看原文連結】</a></div></article>')
        for headline,expected in [(title,1),('A completely different news article',0)]:
            response=Response();response.status_code=200;response.headers['Content-Type']='text/html; charset=utf-8';response.encoding='utf-8'
            response._content=f'<meta property="og:title" content="{headline}"><meta property="og:image" content="https://img.ltn.com.tw/a.jpg">'.encode();response._content_consumed=True
            with patch('core.http.get',return_value=response):
                result=quality.publisher_linked_images(soup,'https://tw.news.yahoo.com/a',title,['article .atoms'])
            self.assertEqual(len(result),expected)
        with patch('core.http.get') as fetch:
            self.assertEqual(quality.publisher_linked_images(self.parse('<article><a href="https://example.com/a">Recommended</a></article>'),'https://tw.news.yahoo.com/a',title),[])
            fetch.assert_not_called()

if __name__=='__main__':unittest.main()
