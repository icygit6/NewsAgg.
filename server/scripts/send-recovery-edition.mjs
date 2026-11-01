// Explicit operator recovery, never scheduled. Does not change ingestion status,
// deadlines or the normal morning completion gate. Preview by default; --send
// requires human authorization to mail a separately validated published snapshot.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import dotenv from 'dotenv';
import pg from 'pg';
import nodemailer from 'nodemailer';
import {taipeiDay,renderDigest} from './daily-policy.mjs';
import {loadEditionRows,assessEdition,editionWindow} from './daily-edition.mjs';
import {fetchDailyQuote} from './daily-quote.mjs';
import {readJson,atomicJson,acquireLock,deliver} from './daily-runtime.mjs';
import {resolveRecipients} from './daily-recipients.mjs';
import {loadSubscribers,planRecipients,personalizeMessage,subscriberLimit,unsubscribeKey,unsubscribeUrl} from './daily-subscribers.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const {values:args}=parseArgs({options:{day:{type:'string'},send:{type:'boolean'}}});
const day=args.day||taipeiDay();
if(day!==taipeiDay()) throw new Error('Recovery is limited to today; historical editions must not be resent');
const persistedRecipients=process.env.REPORT_EMAIL_TO||'';
dotenv.config({path:path.join(root,'server/.env'),quiet:true,override:true});
dotenv.config({path:path.join(root,'.env'),quiet:true});
const config=readJson(path.join(root,'ops/daily-config.json'));
const publicUrl=(process.env.NEWSAGG_STABLE_URL||'').replace(/\/$/,'');
if(!/^https:\/\/[^/]+$/.test(publicUrl)) throw new Error('Stable HTTPS origin required');
const base=path.join(root,'logs/daily'),dir=path.join(base,`manual-${day}`);
const snapshotFile=path.join(dir,'snapshot.json');
const ledgerFile=path.join(base,day,'delivery.json');
fs.mkdirSync(dir,{recursive:true});
const unlock=acquireLock(path.join(base,'delivery.lock'));
try {
  const releaseIngestion=acquireLock(path.join(base,'pipeline.lock'));
  let snapshot,plan,key;
  try {
    const dsn=new URL(process.env.NEONDB_URL||process.env.DATABASE_URL||process.env.NEON_DSN);
    dsn.searchParams.delete('sslmode');dsn.searchParams.delete('sslrootcert');
    const client=new pg.Client({connectionString:dsn.toString(),ssl:['localhost','127.0.0.1','db'].includes(dsn.hostname)?false:{rejectUnauthorized:true},connectionTimeoutMillis:15000,query_timeout:30000});
    try {
      await client.connect();
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      plan=planRecipients(resolveRecipients(config.recipients,persistedRecipients),await loadSubscribers(client,{limit:subscriberLimit(process.env)}));
      key=unsubscribeKey(process.env);
      snapshot=readJson(snapshotFile);
      if(!snapshot) {
        const now=new Date(),{start,cutoff}=editionWindow(day,config);
        if(now<cutoff) throw new Error('Morning publication window has not closed');
        const {rows:eligible}=await loadEditionRows(client,{day,config});
        const rows=eligible.filter(row=>new Date(row.published_at).getTime()>=now.getTime()-config.maxAgeHours*3600000);
        const validation=assessEdition(rows,config);
        if(!validation.ok) throw new Error(validation.reason);
        const runKey=`manual-published-${day}`;
        const report={scope:'published-snapshot',startedAt:start.toISOString(),finishedAt:cutoff.toISOString()};
        const message=renderDigest({day,runKey,report,rows,validation,publicUrl,now,quote:await fetchDailyQuote()});
        snapshot={day,runKey,createdAt:now.toISOString(),mode:'operator-authorized-published-snapshot',articleCount:rows.length,sourceCount:new Set(rows.map(row=>row.source_id)).size,articleIds:rows.map(row=>row.id),validation,message};
        atomicJson(snapshotFile,snapshot);
      }
      if(snapshot.day!==day||!snapshot.validation?.ok||!['partial','complete'].includes(snapshot.validation.status)) throw new Error('Invalid recovery snapshot');
      await client.query('ROLLBACK');
    } finally {await client.end();}
  } finally {releaseIngestion();}
  const recipients=[...plan.team,...plan.subscribers.map(subscriber=>subscriber.email)];
  if(!args.send) {
    console.log(JSON.stringify({preview:true,noEmailSent:true,articleCount:snapshot.articleCount,sourceCount:snapshot.sourceCount,status:snapshot.validation.status,recipients:recipients.length,snapshotFile}));
  } else {
    if(Date.now()-new Date(snapshot.createdAt).getTime()>3600000) throw new Error('Recovery snapshot is over an hour old; operator review required');
    const response=await fetch(`${publicUrl}/health?db=1`,{signal:AbortSignal.timeout(15000),cache:'no-store'});
    const health=await response.json();
    if(!response.ok||!health.ok||health.db!=='up') throw new Error('Public website is not healthy');
    if(!process.env.SMTP_HOST||!process.env.SMTP_USER||!process.env.SMTP_PASS) throw new Error('SMTP configuration incomplete');
    const port=Number(process.env.SMTP_PORT||587);
    const transport=nodemailer.createTransport({host:process.env.SMTP_HOST,port,secure:port===465||['1','true'].includes(process.env.SMTP_SECURE),requireTLS:port!==465,auth:{user:process.env.SMTP_USER.trim(),pass:process.env.SMTP_PASS.replace(/\s/g,'')},connectionTimeout:15000,greetingTimeout:15000,socketTimeout:30000});
    try {
      await transport.verify();
      // Share today's canonical ledger and message identity with scheduled mail:
      // accepted or uncertain deliveries are never silently sent a second time.
      const ledger=readJson(ledgerFile,{});
      await deliver({recipients,ledger,save:value=>atomicJson(ledgerFile,value),transport,message:snapshot.message,day,from:process.env.MAIL_FROM||process.env.SMTP_USER,
        personalize:(to,message)=>{
          const subscriber=plan.byEmail.get(to.toLowerCase());
          return personalizeMessage(message,subscriber?{unsubscribeUrl:unsubscribeUrl(publicUrl,subscriber.id,key),oneClick:true}:{unsubscribeUrl:`${publicUrl}/profile`});
        }});
      const result={day,mode:snapshot.mode,finishedAt:new Date().toISOString(),articleCount:snapshot.articleCount,sourceCount:snapshot.sourceCount,status:snapshot.validation.status,recipientCount:recipients.length,accepted:recipients.filter(to=>ledger[to]?.status==='accepted').length,needsReview:recipients.filter(to=>ledger[to]?.status!=='accepted').length,inboxReceiptConfirmed:false};
      atomicJson(path.join(dir,'result.json'),result);
      console.log(JSON.stringify(result));
      if(result.needsReview) process.exitCode=1;
    } finally {transport.close();}
  }
} finally {unlock();}
