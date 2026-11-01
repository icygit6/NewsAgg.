import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fetchDailyQuote,normalizeQuote} from './daily-quote.mjs';
const quote={body:' Live thoughtfully. ',author:' Example ',url:'https://favqs.com/quotes/example/1'};
test('QOTD fetch uses a timeout and no credential, and normalizes the response',async()=>{
  const result=await fetchDailyQuote({fetchImpl:async(url,options)=>{
    assert.equal(url,'https://favqs.com/api/qotd');
    assert.ok(options.signal instanceof AbortSignal);
    assert.equal(options.headers.Authorization,undefined);
    return {ok:true,json:async()=>({quote})};
  }});
  assert.deepEqual(result,{...quote,body:'Live thoughtfully.',author:'Example'});
});
test('HTTP, API, malformed JSON and empty quote failures do not break email',async()=>{
  for(const response of [{ok:false},{ok:true,json:async()=>({error_code:20,quote})},{ok:true,json:async()=>({quote:{body:'',author:'a'}})},{ok:true,json:async()=>{throw Error('invalid json');}}]) {
    assert.equal(await fetchDailyQuote({fetchImpl:async()=>response}),null);
  }
  assert.equal(await fetchDailyQuote({fetchImpl:async()=>{throw Error('offline');}}),null);
});
test('an unresponsive fetch is aborted within the configured timeout',async()=>{
  const keepAlive=setTimeout(()=>{},1000);
  try {
    assert.equal(await fetchDailyQuote({timeoutMs:10,fetchImpl:async(_,options)=>new Promise((_,reject)=>options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true}))}),null);
  } finally {clearTimeout(keepAlive);}
});
test('external or unsafe quote URLs are replaced and unreasonable payloads rejected',()=>{
  for(const url of ['javascript:alert(1)','https://favqs.com.evil.test/','https://name:pass@favqs.com/']) assert.equal(normalizeQuote({...quote,url}).url,'https://favqs.com');
  assert.equal(normalizeQuote({...quote,body:'x'.repeat(3001)}),null);
  assert.equal(normalizeQuote({...quote,author:42}),null);
});
