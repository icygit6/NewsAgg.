import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nextIngestionAttempt} from './ingestion-state.mjs';

const now=new Date('2026-09-22T12:00:00Z'),deadline=new Date('2026-09-22T14:00:00Z');
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
