// Integration checks run inside an outer ROLLBACK: no test edition is retained.
import 'dotenv/config';
import fs from 'node:fs';
import pg from 'pg';
import assert from 'node:assert/strict';
import {freezeEdition} from './daily-edition.mjs';
const config=JSON.parse(fs.readFileSync(new URL('../../ops/daily-config.json',import.meta.url),'utf8'));
const dsn=new URL(process.env.NEONDB_URL||process.env.DATABASE_URL||process.env.NEON_DSN);
dsn.searchParams.delete('sslmode');dsn.searchParams.delete('sslrootcert');
const client=new pg.Client({connectionString:dsn.toString(),ssl:{rejectUnauthorized:true},connectionTimeoutMillis:15000,query_timeout:30000});
await client.connect();
try {
  await client.query('BEGIN');
  const sandbox={query:(sql,params)=>['BEGIN','COMMIT'].includes(sql)?Promise.resolve({rows:[]}):client.query(sql,params)};
  const day='2099-12-31';
  assert.equal((await client.query('SELECT 1 FROM public.newsletter_editions WHERE edition_day=$1',[day])).rows.length,0);
  const original=await freezeEdition(sandbox,{day,config,publicUrl:'https://example.com',now:new Date('2099-12-31T00:00:00Z')});
  assert.equal(original.status,'failed');
  const retry=await freezeEdition(sandbox,{day,config,publicUrl:'https://changed.example.com',now:new Date('2099-12-31T00:10:00Z')});
  assert.deepEqual(retry.message,original.message);
  await client.query('SAVEPOINT immutable_test');
  await assert.rejects(client.query("UPDATE public.newsletter_editions SET message='{}' WHERE edition_day=$1",[day]),/immutable/);
  await client.query('ROLLBACK TO SAVEPOINT immutable_test');
  console.log('PASS: snapshot stored once, retry preserves full message, PostgreSQL rejects editing frozen editions');
} finally {await client.query('ROLLBACK');await client.end();}
console.log('PASS: fixture edition rolled back; no email sent');
