import copy
import unittest
from datetime import datetime, timezone, timedelta
from core import quality, publication, db


def fixture():
    sentence = 'Researchers tested the observation using independent measurements and documented their scientific findings.'
    text = ' '.join([sentence]*12)
    return {'id':'1111111111111111','url':'https://example.com/science-test','canonical_url':'https://example.com/science-test',
            'title':'A controlled publication test','author':'Test author','author_url':'https://example.com/test-author',
            'source':{'id':'bbc','name':'BBC','domain':'bbc.com','country':'GB','language':'en','logo':None},
            'published_at':datetime.now(timezone.utc).isoformat(),'topic':'Science','ai_top_label':'Science',
            'extraction_version':quality.VERSION,'content':text,'content_hash':quality.content_hash(text),
            'content_blocks':[{'type':'paragraph','text':text}],'ai_summary':sentence,'summary_method':'extractive-test',
            'url_to_image':'https://example.com/hero.jpg','images':[{'url':'https://example.com/hero.jpg'}],
            'quality_metadata':{'category_model':'test-model','summary_evidence':[sentence],'image_status':'verified'},
            'sentiment':{'type':'neutral','score':.5,'comparative':0,'probabilities':{'positive':.2,'neutral':.5,'negative':.3},'model':'test'},
            'toxicity':{'label':None,'score':None},'og':{},'readability':{'word_count':144,'reading_time_min':1,'flesch_score':None,'flesch_kincaid':None,'smog_index':None}}


class PublicationTests(unittest.TestCase):
    def test_duplicate_alternate_url_is_quarantined_without_public_write(self):
        calls = []
        class Cursor:
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def execute(self, sql, params): calls.append((sql, params))
            def fetchone(self): return (1,)
        class Conn:
            def cursor(self): return Cursor()
            def commit(self): pass
        self.assertEqual(db.insert_article(Conn(), fixture()), 'quarantined')
        staged = next(params for sql, params in calls if 'INSERT INTO staging.articles' in sql)
        self.assertEqual(staged[-1].adapted, {'reason': 'duplicate_article'})
        self.assertFalse(any('INSERT INTO articles (' in sql for sql, _ in calls))

    def test_reader_blocks_and_plain_body_must_match(self):
        row=fixture();row['content_blocks']=[{'type':'paragraph','text':'Unrelated body'}]
        self.assertEqual(publication.rejection(row),'body_blocks_mismatch')
        row['content_blocks']=[{'type':'list','items':'not a list'}]
        self.assertEqual(publication.rejection(row),'invalid_body_blocks')
        row['content_blocks']=[{'type':'list','items':[]}]
        self.assertEqual(publication.rejection(row),'invalid_body_blocks')

    def test_hero_must_be_one_of_the_verified_images(self):
        row=fixture();row['url_to_image']='https://example.com/old.jpg'
        self.assertEqual(publication.rejection(row),'image_primary_mismatch')

    def test_ready_article_with_a_verified_photo_is_publishable(self):
        self.assertIsNone(publication.rejection(fixture()))

    def test_article_without_a_publisher_photo_is_rejected(self):
        row=fixture();row.update({'url_to_image':None,'images':[]})
        row['quality_metadata']['image_status']='unavailable'
        self.assertEqual(publication.rejection(row),'no_image')

    def test_incomplete_or_unverified_work_is_not_publishable(self):
        for change in [{'ai_summary':None},{'content_blocks':[]},{'ai_top_label':'Politics'},
                       {'published_at':(datetime.now(timezone.utc)-timedelta(days=40)).isoformat()},
                       {'content_hash':'wrong'}, {'quality_metadata':{'category_model':'test','summary_evidence':['invented'],'image_status':'unavailable'}}]:
            with self.subTest(change=change):
                row=fixture();row.update(change)
                self.assertIsNotNone(publication.rejection(row))

    def test_invalid_record_stays_in_staging_without_public_writes(self):
        calls=[]
        class Cursor:
            def __enter__(self):return self
            def __exit__(self,*args):pass
            def execute(self,sql,params):calls.append(sql)
        class Conn:
            def cursor(self):return Cursor()
            def commit(self):calls.append('COMMIT')
        row=fixture();row['ai_summary']=None
        self.assertEqual(db.insert_article(Conn(),row),'quarantined')
        self.assertTrue(any('staging.articles' in sql for sql in calls))
        self.assertFalse(any('INSERT INTO articles (' in sql for sql in calls))
