import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadSubscribers,planRecipients,personalizeMessage,subscriberLimit,unsubscribeKey,signUnsubscribeToken,unsubscribeUrl,UNSUBSCRIBE_PLACEHOLDER,DEFAULT_SUBSCRIBER_LIMIT} from './daily-subscribers.mjs';
import {renderDigest} from './daily-policy.mjs';
import {deliver} from './daily-runtime.mjs';

const fakeClient=rows=>{const calls=[];return {calls,query:async(sql,params)=>{calls.push({sql,params});return {rows};}};};

test('only verified accounts that switched email updates on are mailed',async()=>{
  const client=fakeClient([{id:1,email:'a@example.com'}]);
  await loadSubscribers(client,{limit:50});
  const {sql,params}=client.calls[0];
  assert.match(sql,/email_updates = true/);
  assert.match(sql,/email_verified = true/);
  assert.deepEqual(params,[50]);
});
test('malformed and duplicate addresses are dropped, order is stable',async()=>{
  const rows=[{id:1,email:'One@Example.com'},{id:2,email:'one@example.com'},{id:3,email:'not-an-address'},{id:4,email:'  two@example.com '},{id:5,email:null}];
  const result=await loadSubscribers(fakeClient(rows.filter(r=>r.email)));
  assert.deepEqual(result,[{id:1,email:'One@Example.com'},{id:4,email:'two@example.com'}]);
});
test('a subscriber who is also on the team list is mailed once, as team',()=>{
  const plan=planRecipients(['team@example.com','Both@Example.com'],[{id:1,email:'both@example.com'},{id:2,email:'only@example.com'}]);
  assert.deepEqual(plan.team,['team@example.com','Both@Example.com']);
  assert.deepEqual(plan.subscribers.map(s=>s.email),['only@example.com']);
  assert.equal(plan.byEmail.get('both@example.com').id,1,'the team member still gets a working unsubscribe link');
});
test('the subscriber cap defaults safely and can be tuned',()=>{
  assert.equal(subscriberLimit({}),DEFAULT_SUBSCRIBER_LIMIT);
  assert.equal(subscriberLimit({NEWSLETTER_MAX_SUBSCRIBERS:'25'}),25);
  assert.equal(subscriberLimit({NEWSLETTER_MAX_SUBSCRIBERS:'-3'}),DEFAULT_SUBSCRIBER_LIMIT);
  assert.equal(subscriberLimit({NEWSLETTER_MAX_SUBSCRIBERS:'many'}),DEFAULT_SUBSCRIBER_LIMIT);
});
test('unsubscribe links are signed per user and need a real secret',()=>{
  assert.throws(()=>unsubscribeKey({}),/SECRET_KEY or JWT_SECRET/);
  const key=unsubscribeKey({JWT_SECRET:'s3cret'});
  const token=signUnsubscribeToken(42,key);
  assert.match(token,/^42\.[A-Za-z0-9_-]{43}$/);
  assert.equal(token,signUnsubscribeToken(42,key),'deterministic, so an old email keeps working');
  assert.notEqual(token.split('.')[1],signUnsubscribeToken(43,key).split('.')[1]);
  assert.notEqual(token,signUnsubscribeToken(42,unsubscribeKey({JWT_SECRET:'other'})));
  assert.throws(()=>signUnsubscribeToken('x',key),/Invalid user id/);
  assert.equal(unsubscribeUrl('https://news.example/',42,key),`https://news.example/api/email/unsubscribe?token=${token}`);
});
test('personalization fills every placeholder and adds one-click headers only for subscribers',()=>{
  const message={subject:'s',html:`<a href="${UNSUBSCRIBE_PLACEHOLDER}">x</a><a href="${UNSUBSCRIBE_PLACEHOLDER}">y</a>`,text:`bye ${UNSUBSCRIBE_PLACEHOLDER}`};
  const subscriber=personalizeMessage(message,{unsubscribeUrl:'https://n.example/u?token=1.x',oneClick:true});
  assert.doesNotMatch(subscriber.html+subscriber.text,/\{\{/);
  assert.equal(subscriber.html.split('https://n.example/u?token=1.x').length-1,2);
  assert.equal(subscriber.headers['List-Unsubscribe'],'<https://n.example/u?token=1.x>');
  assert.equal(subscriber.headers['List-Unsubscribe-Post'],'List-Unsubscribe=One-Click');
  const team=personalizeMessage(message,{unsubscribeUrl:'https://n.example/profile'});
  assert.equal(team.headers['List-Unsubscribe'],undefined);
  assert.match(team.text,/https:\/\/n\.example\/profile/);
  assert.match(message.html,/\{\{UNSUBSCRIBE_URL\}\}/,'the shared message is not mutated');
});
test('the real newsletter carries an unsubscribe link in both bodies',()=>{
  const row={id:'a1',title:'A story',source_id:'bbc',source_name:'BBC',topic:'Science',published_at:new Date()};
  const message=renderDigest({day:'2026-10-21',runKey:'t',report:{startedAt:'2026-10-20T09:00:00Z',finishedAt:'2026-10-20T10:00:00Z'},rows:[row],validation:{ok:true,status:'complete'},publicUrl:'https://example.com'});
  assert.match(message.html,new RegExp(`href="${UNSUBSCRIBE_PLACEHOLDER.replace(/[{}]/g,'\$&')}"[^>]*>Unsubscribe`));
  assert.ok(message.text.includes(UNSUBSCRIBE_PLACEHOLDER));
  const sent=personalizeMessage(message,{unsubscribeUrl:'https://example.com/api/email/unsubscribe?token=1.abc',oneClick:true});
  assert.doesNotMatch(sent.html+sent.text,/\{\{UNSUBSCRIBE_URL\}\}/);
});
test('each recipient is sent their own copy, and one failure does not stop the rest',async()=>{
  const sent=[],ledger={};
  const transport={sendMail:async mail=>{
    if(mail.to==='bad@example.com') throw Object.assign(new Error('no such user'),{responseCode:550});
    sent.push(mail);return {accepted:[mail.to]};
  }};
  const plan=planRecipients([],[{id:7,email:'a@example.com'},{id:8,email:'bad@example.com'},{id:9,email:'c@example.com'}]);
  const key=unsubscribeKey({JWT_SECRET:'k'});
  const message={subject:'s',html:`<a href="${UNSUBSCRIBE_PLACEHOLDER}">u</a>`,text:UNSUBSCRIBE_PLACEHOLDER};
  const personalize=(to,base)=>{const user=plan.byEmail.get(to.toLowerCase());return personalizeMessage(base,{unsubscribeUrl:unsubscribeUrl('https://n.example',user.id,key),oneClick:true});};
  const ok=await deliver({recipients:plan.subscribers.map(s=>s.email),ledger,save:()=>{},transport,message,day:'2026-10-21',from:'from@example.com',personalize});
  assert.equal(ok,false);
  assert.deepEqual(sent.map(m=>m.to),['a@example.com','c@example.com']);
  assert.match(sent[0].html,/token=7\./);
  assert.match(sent[1].html,/token=9\./);
  assert.ok(sent.every(m=>m.headers['List-Unsubscribe']));
  assert.equal(ledger['bad@example.com'].status,'rejected');
  assert.equal(ledger['c@example.com'].status,'accepted');
});
test('deliver without personalization sends the message unchanged',async()=>{
  const sent=[];
  await deliver({recipients:['a@example.com'],ledger:{},save:()=>{},transport:{sendMail:async m=>{sent.push(m);return {accepted:[m.to]};}},message:{subject:'s',text:'t'},day:'d',from:'f@example.com'});
  assert.deepEqual({subject:sent[0].subject,text:sent[0].text},{subject:'s',text:'t'});
});
