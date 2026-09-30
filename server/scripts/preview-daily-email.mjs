// Read-only DB preview of an existing run. Never authenticates to SMTP.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';
import {taipeiDay,validateRun,renderDigest} from './daily-policy.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const day=process.argv[2]||taipeiDay();
if(!/^\d{4}-\d{2}-\d{2}$/.test(day))throw new Error('Use YYYY-MM-DD');
dotenv.config({path:path.join(root,'server/.env'),quiet:true});
dotenv.config({path:path.join(root,'.env'),quiet:true});
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const report=read(`logs/daily/${day}/scraper.json`),state=read(`logs/daily/${day}/state.json`),config=read('ops/daily-config.json');
const dsn=new URL(process.env.NEONDB_URL||process.env.DATABASE_URL||process.env.NEON_DSN);
dsn.searchParams.delete('sslmode');dsn.searchParams.delete('sslrootcert');
const client=new pg.Client({connectionString:dsn.toString(),ssl:{rejectUnauthorized:true},connectionTimeoutMillis:15000,query_timeout:30000});
try {
  await client.connect();
  const {rows}=await client.query(`SELECT a.id,a.title,a.topic,a.source_id,s.name AS source_name,a.published_at,a.ai_summary,
    a.feed_eligible,a.extraction_version,a.content_blocks FROM articles a LEFT JOIN sources s ON s.id=a.source_id
    WHERE a.id=ANY($1::text[]) ORDER BY a.published_at DESC,a.id`,[report.articleIds]);
  const validation=validateRun(report,state.runKey,rows,config,new Date(state.finishedAt||report.finishedAt));
  const message=renderDigest({day,runKey:state.runKey,report,rows:validation.rows||[],validation,publicUrl:process.env.NEWSAGG_STABLE_URL});
  const output=path.join(root,'logs/email-preview',day);
  fs.mkdirSync(output,{recursive:true});
  fs.writeFileSync(path.join(output,'newsletter.html'),message.html,'utf8');
  fs.writeFileSync(path.join(output,'newsletter.txt'),message.text,'utf8');
  console.log(JSON.stringify({output,subject:message.subject,htmlBytes:Buffer.byteLength(message.html),noEmailSent:true}));
} finally {await client.end();}
