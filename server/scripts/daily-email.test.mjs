import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderDigest} from './daily-policy.mjs';
import {digestStats} from './daily-email.mjs';
const row={id:'id" onclick="bad',title:'<script>bad</script>',ai_summary:'A verified summary. '.repeat(100),source_id:'bbc',source_name:'BBC',topic:'Science',published_at:new Date()};
const args={day:'2026-09-22',runKey:'test',report:{startedAt:'2026-09-21T16:05:00Z',finishedAt:'2026-09-21T17:07:00Z'},rows:[row],validation:{ok:true,status:'partial',deficits:{deficit_bbc_Climate:7}},publicUrl:'https://example.com'};
test('newsletter uses email-safe layout with working escaped article links',()=>{
  const result=renderDigest(args);
  assert.match(result.html,/table role="presentation"/);
  assert.match(result.html,/TODAY’S HEADLINES/);
  assert.match(result.html,/Scraped &amp; verified/);
  assert.match(result.html,/今日頭條/);
  assert.match(result.text,/台北時間|網站/);
  assert.match(result.subject,/篇已驗證文章/);
  assert.match(result.html,/href="https:\/\/example.com\/article\/id%22%20onclick%3D%22bad"/);
  assert.doesNotMatch(result.html,/<script>/);
  assert.match(result.html,/&lt;script&gt;/);
  assert.doesNotMatch(result.html,/deficit_bbc_Climate|white-space:pre-wrap/);
  assert.doesNotMatch(result.html,/A verified summary/);
  assert.doesNotMatch(result.text,/A verified summary/);
  assert.doesNotMatch(result.html,/data:image|<script|<svg/i);
  assert.match(result.html,/https:\/\/example.com\/logo-mark-128.png/);
  assert.doesNotMatch(result.html,/DATA CONTOH|BELUM DITERAPKAN|Contoh tampilan|berita|sentimen\b/);
  assert.doesNotMatch(result.html,/[↗→]/);
  assert.doesNotMatch(result.text,/[↗→]/);
  assert.ok(result.html.length<60000);
});
test('partial status is retained without operational coverage or frozen notices',()=>{
  const result=renderDigest({...args,report:{...args.report,scope:'published-snapshot'}});
  assert.match(result.subject,/PARTIAL/);
  assert.doesNotMatch(result.html,/frozen|collection targets|No fresh story|#fffbef/i);
  assert.doesNotMatch(result.text,/frozen|collection targets|No fresh story/i);
});

test('failure layout has no article cards or misleading completed date',()=>{
  const result=renderDigest({...args,report:{startedAt:null,finishedAt:null},error:'Scraper deadline exceeded'});
  assert.match(result.subject,/FAILED/);
  assert.doesNotMatch(result.html,/TODAY’S HEADLINES|TODAY AT A GLANCE|DAILY PERSPECTIVE|1 Jan/);
  assert.match(result.html,/not completed/);
  assert.match(result.html,/失敗通知/);
});

test('totals cover all edition stories, not just the 12 selected headlines',()=>{
  const rows=Array.from({length:16},(_,i)=>({...row,id:String(i),source_id:i%2?'bbc':'cnn',sentiment_type:['positive','neutral','negative',null][i%4]}));
  assert.deepEqual(digestStats(rows),{total:16,sources:2,sentiments:{positive:4,neutral:4,negative:4,unknown:4}});
  const result=renderDigest({...args,rows});
  assert.match(result.text,/已擷取並驗證: 16/);
  assert.match(result.text,/新聞來源: 2/);
  assert.match(result.text,/精選標題: 12/);
  assert.match(result.text,/Unrated／未評分: 4/);
  assert.equal((result.html.match(/class="story-link"/g)||[]).length,12);
});

test('quote and source content are escaped and untrusted quote links are rejected',()=>{
  const result=renderDigest({...args,rows:[{...row,source_name:'<img src=x onerror=bad>'}],quote:{body:'<script>quote</script>',author:'<b>author</b>',url:'javascript:alert(1)'}});
  assert.match(result.html,/&lt;script&gt;quote/);
  assert.match(result.html,/&lt;img src=x onerror=bad&gt;/);
  assert.match(result.html,/href="https:\/\/favqs.com"/);
  assert.doesNotMatch(result.html,/<script>|javascript:/);
  assert.match(result.text,/via FavQs/);
});

test('quote failure renders an honest fallback without changing digest status',()=>{
  const result=renderDigest({...args,quote:null});
  assert.match(result.html,/Daily quote temporarily unavailable/);
  assert.match(result.subject,/PARTIAL/);
  assert.doesNotMatch(result.html,/Jackie Kennedy/);
});
