"""Rollback-only integration proof on the configured DB. No fixture is committed."""
import copy
import uuid
import sys
from pathlib import Path
from core import db
sys.path.insert(0, str(Path(__file__).parent / 'tests'))
from test_publication import fixture

class NoCommit:
    def __init__(self, conn):self.conn=conn
    def cursor(self):return self.conn.cursor()
    def commit(self):pass
    def rollback(self):self.conn.rollback()

conn=db.connect()
wrapped=NoCommit(conn)
row=fixture()
row['id']=uuid.uuid4().hex[:16]
row['url']=row['canonical_url']='https://example.com/test-'+row['id']
row['author_url']='https://example.com/author-'+row['id']
try:
    with conn.cursor() as cur:
        cur.execute('SELECT revision FROM public.publication_state WHERE singleton')
        before=cur.fetchone()[0]
    key=db.stage_candidate(wrapped,{'url':row['url'],'topic':'Science'},'bbc')
    row['_stage_key']=key
    with conn.cursor() as cur:
        cur.execute('SELECT count(*) FROM public.articles WHERE id=%s',(row['id'],))
        assert cur.fetchone()[0]==0, 'Pending staging leaked into production'
    assert db.insert_article(wrapped,row)=='inserted'
    with conn.cursor() as cur:
        cur.execute('SELECT status FROM staging.articles WHERE candidate_key=%s',(key,))
        assert cur.fetchone()[0]=='published'
        cur.execute('SELECT content_hash FROM public.article_publications WHERE article_id=%s',(row['id'],))
        assert cur.fetchone()[0]==row['content_hash']
        cur.execute('SELECT revision FROM public.publication_state WHERE singleton')
        assert cur.fetchone()[0]>before
    duplicate=copy.deepcopy(row)
    duplicate['id']=uuid.uuid4().hex[:16]
    duplicate['url']=duplicate['canonical_url']='https://example.com/test-'+duplicate['id']
    duplicate['_stage_key']=duplicate['id']
    assert db.insert_article(wrapped,duplicate)=='quarantined', 'Alternate URL duplicate was published'
    with conn.cursor() as cur:
        cur.execute('SELECT count(*) FROM public.articles WHERE id=%s',(duplicate['id'],))
        assert cur.fetchone()[0]==0
    bad=copy.deepcopy(row);bad['title']='Must not be published';bad['ai_summary']=None
    assert db.insert_article(wrapped,bad)=='quarantined'
    with conn.cursor() as cur:
        cur.execute('SELECT title FROM public.articles WHERE id=%s',(row['id'],))
        assert cur.fetchone()[0]==row['title'], 'Rejected update overwrote live content'
    print('PASS: pending invisible; atomic publication; revision advances; duplicate quarantined; rejected update preserves live article')
finally:
    conn.rollback()
    with conn.cursor() as cur:
        cur.execute('SELECT count(*) FROM public.articles WHERE id=%s',(row['id'],))
        assert cur.fetchone()[0]==0, 'Rollback failed'
    conn.close()
print('PASS: all fixture writes rolled back; no test article published')
