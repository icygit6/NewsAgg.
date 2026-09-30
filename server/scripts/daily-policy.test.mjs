import {test} from 'node:test';
import assert from 'node:assert/strict';
import {taipeiDay,taipeiTime,validateRun,shouldSend,deliveryOutcome,deliveryError,renderDigest,digestSelection} from './daily-policy.mjs';
const now=new Date('2026-09-21T20:35:00Z');
const config={maxAgeHours:48,minimumArticles:1,minimumSources:1};
const rows=[{id:'one',source_id:'bbc',topic:'World',title:'<unsafe>',published_at:now,feed_eligible:true,extraction_version:'structured-v3',content_blocks:[{type:'paragraph',text:'Evidence'}]}];
const report={runKey:'run1',startedAt:'2026-09-21T17:00:00Z',finishedAt:'2026-09-21T20:00:00Z',status:'complete',errors:0,articleIds:['one'],counts:{}};
test('Taipei day and deadlines cross UTC midnight correctly',()=>{assert.equal(taipeiDay(now),'2026-09-22');assert.equal(taipeiTime('2026-09-22','04:40').toISOString(),'2026-09-21T20:40:00.000Z');});
test('only the exact completed run can produce a digest',()=>{assert.equal(validateRun(report,'run1',rows,config,now).ok,true);for(const bad of [{...report,runKey:'old'},{...report,status:'running'},{...report,finishedAt:null},{...report,errors:1},{...report,startedAt:'invalid'},{...report,finishedAt:'invalid'}]) assert.equal(validateRun(bad,'run1',rows,config,now).ok,false);});
test('missing, stale, future, or ineligible articles fail validation',()=>{assert.equal(validateRun(report,'run1',[],config,now).ok,false);for(const change of [{published_at:'2020-01-01'},{published_at:'2099-01-01'},{feed_eligible:false},{content_blocks:[]}])assert.equal(validateRun(report,'run1',[{...rows[0],...change}],config,now).ok,false);});
test('partial quotas remain explicit instead of being labelled complete',()=>{const result=validateRun({...report,counts:{deficit_bbc_Climate:3}},'run1',rows,config,now);assert.equal(result.status,'partial');assert.equal(result.deficits.deficit_bbc_Climate,3);});
test('minimum coverage is enforced',()=>{assert.equal(validateRun(report,'run1',rows,{...config,minimumSources:2},now).ok,false);});
test('accepted, in-flight and uncertain mail are never resent',()=>{for(const status of ['accepted','sending','uncertain'])assert.equal(shouldSend({status}),false);assert.equal(shouldSend({status:'rejected'}),true);assert.equal(shouldSend(undefined),true);});
test('SMTP rejection differs from ambiguous connection failure',()=>{assert.equal(deliveryOutcome({accepted:['a']}),'accepted');assert.equal(deliveryOutcome({accepted:[],rejected:['a']}),'rejected');assert.equal(deliveryError({responseCode:550}),'rejected');assert.equal(deliveryError({code:'ETIMEDOUT'}),'uncertain');});
test('failure email cannot masquerade as a digest and publisher HTML is escaped',()=>{const failed=renderDigest({day:'2026-09-22',runKey:'r',publicUrl:'https://example.com',error:'Scraper timeout'});assert.match(failed.subject,/FAILED/);assert.match(failed.text,/not a successful/);const good=renderDigest({day:'d',runKey:'r',publicUrl:'https://example.com',rows,report,validation:{ok:true,status:'partial',deficits:{}}});assert.match(good.html,/&lt;unsafe&gt;/);assert.doesNotMatch(good.html,/<unsafe>/);});
test('articles aging out during the wait are excluded, never replaced with an unrelated run',()=>{
  const expired={...rows[0],id:'expired',published_at:'2026-09-19T19:00:00Z'};
  const result=validateRun({...report,articleIds:['one','expired']},'run1',[...rows,expired],config,now);
  assert.equal(result.ok,true);assert.equal(result.status,'partial');assert.equal(result.expiredCount,1);
  assert.deepEqual(result.rows.map(r=>r.id),['one']);
});
test('digest sample covers every available category and balances sources',()=>{
  const candidates=['Business','Climate','Health','Lifestyle','Politics','Science','Sport','World'].flatMap(topic=>
    ['bbc','cnn'].map(source_id=>({...rows[0],id:`${topic}-${source_id}`,topic,source_id})));
  const selected=digestSelection(candidates,12,now);
  assert.equal(selected.length,12);assert.equal(new Set(selected.map(r=>r.topic)).size,8);
  assert.equal(selected.filter(r=>r.source_id==='bbc').length,6);
  assert.equal(new Set(selected.map(r=>r.id)).size,12);
});
