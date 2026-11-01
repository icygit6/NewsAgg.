import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker,{tunnelOrigin,edgeCacheUrl} from './worker.mjs';
test('accepts only a bare HTTPS Quick Tunnel origin',()=>{
  assert.equal(tunnelOrigin('https://one-two.trycloudflare.com'),'https://one-two.trycloudflare.com');
  for(const url of ['http://localhost','https://evil.test','https://one.trycloudflare.com.evil.test','https://user:secret@one.trycloudflare.com','https://one.trycloudflare.com/api','https://one.trycloudflare.com?url=bad','https://one.trycloudflare.com:8443']) assert.equal(tunnelOrigin(url),null);
});
test('fails closed until configured',async()=>{
  const response=await worker.fetch(new Request('https://newsagg.example.workers.dev/'),{});
  assert.equal(response.status,503);
});

test('keeps browser cookies and origin stable while upstream tunnels change',async(t)=>{
  const seen=[];
  t.mock.method(globalThis,'fetch',async(request)=>{
    seen.push({url:request.url,cookie:request.headers.get('cookie'),origin:request.headers.get('origin')});
    return new Response('ok',{headers:{'Set-Cookie':'newsagg_session=test-only; HttpOnly; Secure; SameSite=Lax; Path=/'}});
  });
  for(const host of ['old-tunnel','new-tunnel']){
    const r=await worker.fetch(new Request('https://newsagg.example.workers.dev/auth/me',{headers:{cookie:'newsagg_session=test-only',origin:'https://newsagg.example.workers.dev'}}),{NEWSAGG_ORIGIN:`https://${host}.trycloudflare.com`});
    assert.equal(r.status,200);
    assert.equal(r.headers.get('Cache-Control'),'private, no-store');
    assert.match(r.headers.get('Set-Cookie'),/HttpOnly/);
  }
  assert.equal(seen[0].cookie,seen[1].cookie);
  assert.equal(seen[0].origin,seen[1].origin);
  assert.match(seen[1].url,/new-tunnel\.trycloudflare\.com\/auth\/me$/);
});

test('rewrites only redirects to the upstream hostname',async(t)=>{
  t.mock.method(globalThis,'fetch',async()=>new Response(null,{status:302,headers:{Location:'https://old-tunnel.trycloudflare.com/profile?tab=settings'}}));
  const r=await worker.fetch(new Request('https://newsagg.example.workers.dev/auth/me'),{NEWSAGG_ORIGIN:'https://old-tunnel.trycloudflare.com'});
  assert.equal(r.headers.get('Location'),'https://newsagg.example.workers.dev/profile?tab=settings');
});

test('returns a non-cacheable offline response',async(t)=>{
  t.mock.method(globalThis,'fetch',async()=>{throw new Error('offline')});
  const r=await worker.fetch(new Request('https://newsagg.example.workers.dev/'),{NEWSAGG_ORIGIN:'https://old-tunnel.trycloudflare.com'});
  assert.equal(r.status,503);
  assert.equal(r.headers.get('Cache-Control'),'no-store');
});

test('lets search engines index reader pages but not private paths',async(t)=>{
  t.mock.method(globalThis,'fetch',async()=>new Response('ok',{headers:{'X-Robots-Tag':'none'}}));
  const env={NEWSAGG_ORIGIN:'https://old-tunnel.trycloudflare.com'};
  const home=await worker.fetch(new Request('https://newsagg.example.workers.dev/article/0123456789abcdef'),env);
  assert.equal(home.headers.get('X-Robots-Tag'),null);
  for(const path of ['/api/news-from-db','/admin','/dbviewer/']){
    const r=await worker.fetch(new Request(`https://newsagg.example.workers.dev${path}`),env);
    assert.equal(r.headers.get('X-Robots-Tag'),'noindex, nofollow');
  }
});

import { edgeTtl, ROBOTS } from './worker.mjs';
test('edge cache keeps private paths out and hashed assets for a year', () => {
  assert.equal(edgeTtl('/api/news-from-db'), 0);
  assert.equal(edgeTtl('/auth/google'), 0);
  assert.equal(edgeTtl('/dbviewer/'), 0);
  assert.equal(edgeTtl('/assets/index-abc.js'), 31536000);
  assert.equal(edgeTtl('/logo-mark-128.png'), 86400);
  assert.equal(edgeTtl('/', 'text/html'), 60);
  assert.equal(edgeTtl('/article/123', 'text/html'), 60);
  assert.equal(edgeTtl('/article/123', 'application/json'), 0);
});
test('robots.txt holds only standard directives', () => {
  assert.ok(!/Content-Signal/i.test(ROBOTS));
  assert.match(ROBOTS, /Disallow: \/api\//);
});

test('static asset versions bypass legacy keys without splitting HTML route caches', () => {
  const origin='https://newsagg.example.workers.dev';
  const old=edgeCacheUrl(`${origin}/logo-mark-128.png`);
  const fresh=edgeCacheUrl(`${origin}/logo-mark-128.png?v=sentiment-20261022`);
  assert.notEqual(old,`${origin}/logo-mark-128.png`);
  assert.notEqual(old,fresh);
  assert.equal(new URL(fresh).searchParams.get('v'),'sentiment-20261022');
  assert.equal(edgeCacheUrl(`${origin}/?view=research`),`${origin}/`);
  assert.equal(edgeCacheUrl(`${origin}/logo-mark-128.png?utm_source=x`),old);
  assert.equal(edgeCacheUrl(`${origin}/logo-mark-128.png?v=invalid%20version`),old);
});

test('cache lookup and insertion use the same version-aware asset key', async(t) => {
  const seen=[];
  const previous=Object.getOwnPropertyDescriptor(globalThis,'caches');
  Object.defineProperty(globalThis,'caches',{configurable:true,value:{default:{
    match:async(key)=>{seen.push(['match',key.url]);return undefined;},
    put:async(key)=>{seen.push(['put',key.url]);},
  }}});
  t.after(()=>previous?Object.defineProperty(globalThis,'caches',previous):delete globalThis.caches);
  t.mock.method(globalThis,'fetch',async()=>new Response('new-logo',{headers:{'Content-Type':'image/png'}}));
  const tasks=[];
  const response=await worker.fetch(new Request('https://newsagg.example.workers.dev/favicon.png?v=sentiment-20261022'),{NEWSAGG_ORIGIN:'https://old-tunnel.trycloudflare.com'},{waitUntil:p=>tasks.push(p)});
  await Promise.all(tasks);
  assert.equal(await response.text(),'new-logo');
  assert.equal(seen[0][1],seen[1][1]);
  assert.match(seen[0][1],/v=sentiment-20261022/);
});
