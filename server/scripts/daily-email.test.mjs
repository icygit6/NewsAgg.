import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderDigest} from './daily-policy.mjs';
const row={id:'id" onclick="bad',title:'<script>bad</script>',ai_summary:'A verified summary. '.repeat(100),source_id:'bbc',source_name:'BBC',topic:'Science',published_at:new Date()};
const args={day:'2026-09-22',runKey:'test',report:{startedAt:'2026-09-21T16:05:00Z',finishedAt:'2026-09-21T17:07:00Z'},rows:[row],validation:{ok:true,status:'partial',deficits:{deficit_bbc_Climate:7}},publicUrl:'https://example.com'};
test('newsletter uses email-safe layout with working escaped article links',()=>{
  const result=renderDigest(args);
  assert.match(result.html,/table role="presentation"/);
  assert.match(result.html,/Today's reading list/);
  assert.match(result.html,/Collection coverage/);
  assert.match(result.html,/今日選讀|每日簡報/);
  assert.match(result.html,/蒐集涵蓋範圍/);
  assert.match(result.text,/時區|網站/);
  assert.match(result.subject,/篇已驗證文章/);
  assert.match(result.html,/href="https:\/\/example.com\/article\/id%22%20onclick%3D%22bad"/);
  assert.doesNotMatch(result.html,/<script>/);
  assert.match(result.html,/&lt;script&gt;/);
  assert.doesNotMatch(result.html,/deficit_bbc_Climate|white-space:pre-wrap/);
  assert.ok(result.html.length<60000);
});
test('partial status stays visible and missing categories are explicit',()=>{
  const result=renderDigest(args);
  assert.match(result.subject,/PARTIAL/);
  assert.match(result.html,/Scraping finished; coverage is incomplete/);
  assert.match(result.html,/No fresh story/);
});
test('failure layout has no article cards or misleading completed date',()=>{
  const result=renderDigest({...args,report:{startedAt:null,finishedAt:null},error:'Scraper deadline exceeded'});
  assert.match(result.subject,/FAILED/);
  assert.doesNotMatch(result.html,/Today's reading list|1 Jan/);
  assert.match(result.html,/not completed/);
  assert.match(result.html,/失敗通知/);
});
