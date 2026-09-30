import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {atomicJson,readJson,acquireLock,deliver,command} from './daily-runtime.mjs';
test('atomic state and live process lock prevent overlapping pipeline owners',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'newsagg-test-'));
  try {
    const state=path.join(dir,'state.json'),lock=path.join(dir,'lock');
    atomicJson(state,{phase:'prepared'});assert.equal(readJson(state).phase,'prepared');
    const release=acquireLock(lock);assert.throws(()=>acquireLock(lock),/already running/);release();
    const again=acquireLock(lock);again();
  } finally {fs.rmSync(dir,{recursive:true});}
});
test('SMTP intent is durable before send, recipient acceptance survives restart',async()=>{
  const ledger={},saved=[],recipients=['one@example.com','two@example.com'];let count=0;
  const options={recipients,ledger,save:value=>saved.push(structuredClone(value)),transport:{sendMail:async({to})=>{assert.equal(saved.at(-1)[to].status,'sending');count++;return {accepted:[to]};}},message:{subject:'test'},day:'2026-09-22',from:'sender@example.com'};
  assert.equal(await deliver(options),true);assert.equal(count,2);
  assert.equal(await deliver(options),true);assert.equal(count,2);
});
test('connection loss after DATA remains uncertain and is not retried',async()=>{
  const ledger={};let count=0;
  const options={recipients:['one@example.com'],ledger,save:()=>{},transport:{sendMail:async()=>{count++;throw {code:'ETIMEDOUT'};}},message:{},day:'2026-09-22'};
  assert.equal(await deliver(options),false);assert.equal(ledger['one@example.com'].status,'uncertain');
  await deliver(options);assert.equal(count,1);
});
test('explicit SMTP rejection can retry without repeating an accepted recipient',async()=>{
  const ledger={'one@example.com':{status:'accepted'}};let count=0;
  const options={recipients:['one@example.com','two@example.com'],ledger,save:()=>{},transport:{sendMail:async({to})=>{count++;if(count===1)throw {responseCode:451};return {accepted:[to]};}},message:{},day:'2026-09-22'};
  assert.equal(await deliver(options),false);assert.equal(ledger['two@example.com'].status,'rejected');
  assert.equal(await deliver(options),true);assert.equal(count,2);
});
test('persisted sending state after a crash is never blindly resent',async()=>{
  const ledger={'one@example.com':{status:'sending'}};
  assert.equal(await deliver({recipients:Object.keys(ledger),ledger,save:()=>{},transport:{sendMail:()=>assert.fail('duplicate')},message:{},day:'d'}),false);
});
test('process deadline is enforced and nonzero exits fail',async()=>{
  await assert.rejects(command(process.execPath,['-e','setTimeout(()=>{},5000)'],{timeout:40}),/deadline/);
  await assert.rejects(command(process.execPath,['-e','process.exit(3)']),/exited 3/);
});
