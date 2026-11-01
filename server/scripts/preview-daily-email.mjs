// Read-only preview: node server/scripts/preview-daily-email.mjs YYYY-MM-DD --edition
// Omit --edition to preview a legacy run report. Never authenticates to SMTP.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import dotenv from 'dotenv';
import pg from 'pg';
import {taipeiDay,validateRun,renderDigest} from './daily-policy.mjs';
import {personalizeMessage} from './daily-subscribers.mjs';
import {loadEditionRows,assessEdition,editionWindow} from './daily-edition.mjs';
import {fetchDailyQuote} from './daily-quote.mjs';
import {digestStats} from './daily-email.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const {values,positionals}=parseArgs({options:{edition:{type:'boolean'}},allowPositionals:true});
const day=positionals[0]||taipeiDay();
if(!/^\d{4}-\d{2}-\d{2}$/.test(day))throw new Error('Use YYYY-MM-DD');
dotenv.config({path:path.join(root,'server/.env'),quiet:true});
dotenv.config({path:path.join(root,'.env'),quiet:true});
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const config=read('ops/daily-config.json'),edition=values.edition;
const dsn=new URL(process.env.NEONDB_URL||process.env.DATABASE_URL||process.env.NEON_DSN);
dsn.searchParams.delete('sslmode');dsn.searchParams.delete('sslrootcert');
const client=new pg.Client({connectionString:dsn.toString(),ssl:['localhost','127.0.0.1','db'].includes(dsn.hostname)?false:{rejectUnauthorized:true},connectionTimeoutMillis:15000,query_timeout:30000});
let report,state,validation,now=new Date(),frozen;
try {
  await client.connect();
  await client.query('BEGIN READ ONLY');
  if(edition) {
    const {start,cutoff}=editionWindow(day,config);
    now=cutoff;
    const {rows}=await loadEditionRows(client,{day,config});
    validation={...assessEdition(rows,config),rows};
    report={scope:'published-snapshot',startedAt:start.toISOString(),finishedAt:cutoff.toISOString()};
    state={runKey:`edition-${day}`};
    frozen=(await client.query('SELECT status FROM public.newsletter_editions WHERE edition_day=$1',[day])).rows[0]?.status||null;
  } else {
    report=read(`logs/daily/${day}/scraper.json`);state=read(`logs/daily/${day}/state.json`);
    const {rows}=await client.query(`SELECT a.id,a.title,a.topic,a.source_id,s.name AS source_name,a.published_at,a.sentiment_type,
    a.feed_eligible,a.extraction_version,a.content_blocks FROM articles a LEFT JOIN sources s ON s.id=a.source_id
    WHERE a.id=ANY($1::text[]) ORDER BY a.published_at DESC,a.id`,[report.articleIds]);
    now=new Date(state.finishedAt||report.finishedAt);
    validation=validateRun(report,state.runKey,rows,config,now);
  }
  await client.query('ROLLBACK');
} finally {await client.end();}
const quote=validation.ok?await fetchDailyQuote():null;
const rows=validation.rows||[];
const message=personalizeMessage(renderDigest({day,runKey:state.runKey,report,rows,validation,publicUrl:process.env.NEWSAGG_STABLE_URL,now,quote}),{unsubscribeUrl:`${process.env.NEWSAGG_STABLE_URL}/profile`});
const output=path.join(root,'logs/email-preview',day);
fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(path.join(output,'newsletter.html'),message.html,'utf8');
fs.writeFileSync(path.join(output,'newsletter.txt'),message.text,'utf8');
console.log(JSON.stringify({output,subject:message.subject,htmlBytes:Buffer.byteLength(message.html),stats:digestStats(rows),quoteAvailable:Boolean(quote),existingEditionStatus:frozen,noEmailSent:true,noDatabaseWrites:true}));
