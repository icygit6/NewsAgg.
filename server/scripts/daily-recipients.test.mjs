import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseRecipients,resolveRecipients,uniqueRecipients} from './daily-recipients.mjs';

test('scheduled recipients include configured addresses and saved additions',()=>{
  assert.deepEqual(resolveRecipients(['first@example.com','second@example.com'],'third@example.com'),
    ['first@example.com','second@example.com','third@example.com']);
});
test('manual recipients replace the list for only that run',()=>{
  assert.deepEqual(resolveRecipients(['first@example.com'],'third@example.com','fourth@example.com'),
    ['fourth@example.com']);
});
test('saved additions are deduplicated without dropping configured addresses',()=>{
  assert.deepEqual(uniqueRecipients(['first@example.com'],parseRecipients('FIRST@example.com;next@example.com')),
    ['first@example.com','next@example.com']);
});
test('invalid addresses cannot be saved or sent',()=>{
  assert.throws(()=>parseRecipients('bad\nBcc:other@example.com'));
  assert.throws(()=>resolveRecipients(['first@example.com'],'','not-an-email'));
});
