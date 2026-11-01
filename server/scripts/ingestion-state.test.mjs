import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nextIngestionAttempt,assertCompletedIngestion,planScraperBudget} from './ingestion-state.mjs';

const now=new Date('2026-09-22T12:00:00Z'),deadline=new Date('2026-09-22T14:00:00Z');

test('scraper receives an earlier cooperative cutoff without extending the original deadline',()=>{
  const hard=new Date(now.getTime()+210*60000);
  const budget=planScraperBudget(hard,{now});
  assert.equal(budget.stopAt.toISOString(),new Date(now.getTime()+200*60000).toISOString());
  assert.equal(budget.deadline.toISOString(),hard.toISOString());
  assert.equal(budget.reserveMs,10*60000);
  const retry=planScraperBudget(hard,{now:new Date(hard.getTime()-60000)});
  assert.ok(retry.stopAt<hard);
  assert.equal(retry.deadline.toISOString(),hard.toISOString());
  assert.throws(()=>planScraperBudget(now,{now}),/Insufficient time/);
  assert.throws(()=>planScraperBudget('invalid',{now}),/Insufficient time/);
});

test('email waits for the matching validated ingestion to finish, even with quota deficits',()=>{
  const day='2026-10-17',cutoff=new Date('2026-10-17T05:40:00+08:00');
  const state={day,runKey:'r',phase:'complete',validation:{ok:true},finishedAt:'2026-10-16T18:49:09+08:00'};
  const report={runKey:'r',status:'partial',errors:0,startedAt:'2026-10-16T17:00:00+08:00',finishedAt:'2026-10-16T18:48:40+08:00'};
  assert.equal(assertCompletedIngestion(state,report,{day,cutoff}).status,'partial');
  for(const change of [{phase:'scraping'},{phase:'failed'},{day:'2026-10-16'},{validation:{ok:false}},{error:'deadline'},{finishedAt:'invalid'},{finishedAt:'2026-10-17T05:41:00+08:00'}]) {
    assert.throws(()=>assertCompletedIngestion({...state,...change},report,{day,cutoff}),/Email held/);
  }
  for(const change of [{runKey:'other'},{status:'running'},{errors:1},{finishedAt:null},{startedAt:'invalid'}]) {
    assert.throws(()=>assertCompletedIngestion(state,{...report,...change},{day,cutoff}),/Email held/);
  }
  assert.throws(()=>assertCompletedIngestion(null,null,{day,cutoff}),/Email held/);
});
test('first ingestion attempt persists its absolute deadline',()=>{
  const result=nextIngestionAttempt({phase:'pending',runKey:'one'},{now,deadline});
  assert.equal(result.attempt,1);assert.equal(result.scrapeDeadline,deadline.toISOString());
  assert.equal(result.runKey,'one');
});
test('interrupted run gets a new identity and keeps history and original deadline',()=>{
  const state={day:'2026-09-23',runKey:'one',phase:'scraping',scrapeDeadline:deadline.toISOString()};
  const result=nextIngestionAttempt(state,{now,deadline:new Date('2026-09-22T20:00:00Z')});
  assert.equal(result.attempt,2);assert.equal(result.phase,'pending');assert.notEqual(result.runKey,'one');
  assert.equal(result.scrapeDeadline,deadline.toISOString());assert.equal(result.history[0].runKey,'one');
  assert.equal(state.phase,'scraping');
});
test('completed ingestion is not rerun and retries cannot escape count/time limits',()=>{
  const complete={phase:'complete'};assert.equal(nextIngestionAttempt(complete,{now,deadline}),complete);
  assert.throws(()=>nextIngestionAttempt({phase:'failed',attempt:3},{now,deadline}),/retry limit/);
  assert.throws(()=>nextIngestionAttempt({phase:'scraping',scrapeDeadline:now.toISOString()},{now,deadline}),/budget exhausted/);
});

test('a queued backup after the morning cutoff preserves the failed attempt',()=>{
  const state={day:'2026-10-06',runKey:'original',phase:'failed',attempt:1,
    scrapeDeadline:'2026-10-05T20:25:00.000Z',error:'Command deadline exceeded'};
  const before=structuredClone(state);
  assert.throws(()=>nextIngestionAttempt(state,{
    now:new Date('2026-10-05T20:25:37.005Z'),
    deadline:new Date('2026-10-06T00:00:00Z'),
  }),/budget exhausted/);
  assert.deepEqual(state,before);
});
