import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ingestionEdition,editionWindow,assessEdition,freezeEdition} from './daily-edition.mjs';
const config={startTime:'17:00',freezeTime:'04:30',maxAgeHours:48,minimumArticles:1,minimumSources:1,targetPerSourceCategory:1,sourceCategories:{bbc:['Science']}};
const day='2026-09-23',now=new Date('2026-09-22T20:30:05Z');
const row={id:'one',topic:'Science',source_id:'bbc',source_name:'BBC',published_at:'2026-09-22T12:00:00Z',title:'Verified science',ai_summary:'A summary supported by the article.',sentiment_type:'positive'};
test('17:00 ingestion belongs to tomorrow, including a year boundary',()=>{
  assert.equal(ingestionEdition(new Date('2026-12-31T09:00:00Z')),'2027-01-01');
  assert.equal(ingestionEdition(new Date('2026-12-31T08:59:00Z')),'2026-12-31');
  assert.equal(ingestionEdition(new Date('2026-09-22T19:00:00Z')),'2026-09-23');
});
test('morning edition covers the previous 17:00 through 04:30 Taipei',()=>{
  const {start,cutoff}=editionWindow(day,config);
  assert.equal(start.toISOString(),'2026-09-22T09:00:00.000Z');
  assert.equal(cutoff.toISOString(),'2026-09-22T20:30:00.000Z');
});
test('coverage gates distinguish empty, partial and full editions',()=>{
  assert.equal(assessEdition([],config).status,'failed');
  assert.equal(assessEdition([row],config).status,'complete');
  assert.equal(assessEdition([row],{...config,targetPerSourceCategory:2}).status,'partial');
});
test('freeze stores the whole message and reads only approved public articles',async()=>{
  const calls=[];
  const client={query:async(sql,params)=>{
    calls.push([sql,params]);
    if(sql.startsWith('SELECT *'))return {rows:[]};
    if(sql.includes('FROM public.articles'))return {rows:[row]};
    if(sql.startsWith('INSERT INTO'))return {rows:[{message:JSON.parse(params[5]),selected_ids:JSON.parse(params[3])}]};
    return {rows:[]};
  }};
  let quoteCalls=0;
  const quote={body:'A daily thought.',author:'Test author',url:'https://favqs.com'};
  const edition=await freezeEdition(client,{day,config,now,publicUrl:'https://example.com',loadQuote:async()=>{quoteCalls++;return quote;}});
  assert.equal(quoteCalls,1);
  assert.match(edition.message.html,/A daily thought/);
  assert.match(edition.message.text,/Positive／正面: 1/);
  assert.deepEqual(JSON.parse(calls.find(([sql])=>sql.startsWith('INSERT INTO'))[1][4]).quote,quote);
  assert.deepEqual(edition.selected_ids,['one']);
  assert.match(edition.message.html,/Morning|morning/);
  assert.match(edition.message.text,/validated articles already published/);
  const sql=calls.find(([sql])=>sql.includes('FROM public.articles'))[0];
  assert.match(sql,/JOIN public.article_publications/);assert.match(sql,/p.content_hash=a.content_hash/);
  assert.match(sql,/a.sentiment_type/);
  assert.doesNotMatch(sql,/staging/);assert.equal(calls.at(-1)[0],'COMMIT');
});
test('restart reuses the immutable edition without reading changed articles',async()=>{
  const original={message:{html:'frozen original'},status:'partial'};
  const client={query:async sql=>{if(sql.includes('FROM public.articles'))assert.fail('snapshot rebuilt');return {rows:sql.startsWith('SELECT *')?[original]:[]};}};
  assert.equal(await freezeEdition(client,{day,config,now,publicUrl:'https://example.com',loadQuote:()=>assert.fail('quote refetched')}),original);
});

test('quote outage still freezes a valid digest; failed editions skip quote fetching',async()=>{
  for(const rows of [[row],[]]) {
    let quoteCalls=0;
    const client={query:async(sql,params)=>{
      if(sql.startsWith('SELECT *'))return {rows:[]};
      if(sql.includes('FROM public.articles'))return {rows};
      if(sql.startsWith('INSERT INTO'))return {rows:[{status:params[2],message:JSON.parse(params[5])}]};
      return {rows:[]};
    }};
    const edition=await freezeEdition(client,{day,config,now,publicUrl:'https://example.com',loadQuote:async()=>{quoteCalls++;return null;}});
    assert.equal(quoteCalls,rows.length?1:0);
    assert.equal(edition.status,rows.length?'complete':'failed');
    if(rows.length)assert.match(edition.message.html,/Daily quote temporarily unavailable/);
    else assert.doesNotMatch(edition.message.html,/TODAY AT A GLANCE|DAILY PERSPECTIVE/);
  }
});
test('freeze cannot run early and rolls back on database failure',async()=>{
  await assert.rejects(freezeEdition({query:()=>assert.fail('early query')},{day,config,now:new Date('2026-09-22T20:00:00Z')}),/before its cutoff/);
  const calls=[];
  const client={query:async sql=>{calls.push(sql);if(sql.startsWith('SELECT *'))throw new Error('offline');return {rows:[]};}};
  await assert.rejects(freezeEdition(client,{day,config,now}),/offline/);
  assert.equal(calls.at(-1),'ROLLBACK');
});
