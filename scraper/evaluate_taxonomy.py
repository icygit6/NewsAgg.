"""Small real-model smoke check, plus optional read-only recent-article audit.

This is not a statistically representative accuracy benchmark. No DB writes.
"""
import argparse
import json
from core import db, nlp
from core.taxonomy import LOCAL_LABELS, classification_context

CASES = [
    ('Sport', 'Argentina wins football World Cup final after penalty shootout'),
    ('Health', 'Clinical trial finds new cancer treatment improves patient survival'),
    ('Business', 'Company earnings rise as revenue and quarterly profit beat forecasts'),
    ('World', 'Ceasefire negotiations resume as fighting forces civilians from their homes'),
    ('Politics', 'Parliament votes on election reform legislation ahead of national ballot'),
    ('Lifestyle', 'Actor announces new film and concert tour at entertainment festival'),
    ('Science', 'Scientists discover a new quantum computing error correction method'),
    ('Climate', 'Carbon emissions accelerate global warming and melting of glaciers'),
    ('Lifestyle', 'G胖超愛唱歌？《CS》之父爆料辦公室連唱5個月 怪人行為：吵到員工都把門關上'),
    ('Science', '研究團隊突破量子電腦錯誤校正技術，實驗結果刊登科學期刊'),
]

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--recent', action='store_true')
    args=parser.parse_args()
    descriptions=list(LOCAL_LABELS.values())
    reverse={v:k for k,v in LOCAL_LABELS.items()}
    result=nlp._classifier()([title for _,title in CASES],candidate_labels=descriptions,multi_label=False,hypothesis_template='This news is about {}.')
    samples=[]
    for (expected,title),output in zip(CASES,result):
        samples.append({'title':title,'expected':expected,'predicted':reverse[output['labels'][0]],'score':round(output['scores'][0],3)})
    print(json.dumps({'smoke':samples,'correctTopLabel':sum(s['expected']==s['predicted'] for s in samples),'total':len(samples)},ensure_ascii=False),flush=True)
    if args.recent:
        conn=db.connect()
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT a.id,a.title,a.content,a.topic,a.source_id FROM articles a JOIN article_publications p ON p.article_id=a.id WHERE a.topic='Science' ORDER BY p.approved_at DESC LIMIT 5")
                rows=cur.fetchall()
            for article_id,title,content,topic,source in rows:
                item={'title_hint':title,'content_hint':classification_context(content),'topic':topic,'source_key':source}
                accepted=bool(nlp.zero_shot_filter([item]))
                print(json.dumps({'id':article_id,'title':title,'storedTopic':topic,'accepted':accepted,'reason':item.get('rejection'),'model':item.get('category_model')},ensure_ascii=False),flush=True)
        finally:
            conn.close()
    if any(sample['expected'] != sample['predicted'] for sample in samples):
        raise SystemExit('Taxonomy smoke check failed; do not promote this classifier configuration')

if __name__=='__main__':
    main()
