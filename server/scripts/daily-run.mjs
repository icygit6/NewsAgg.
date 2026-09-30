import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {parseArgs} from 'node:util';
import dotenv from 'dotenv';
import pg from 'pg';
import nodemailer from 'nodemailer';
import {taipeiDay,taipeiTime,validateRun,renderDigest} from './daily-policy.mjs';
import {readJson,atomicJson,acquireLock,command,deliver} from './daily-runtime.mjs';
import {freezeEdition,ingestionEdition} from './daily-edition.mjs';
import {nextIngestionAttempt} from './ingestion-state.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const {values:args}=parseArgs({options:{'dry-run':{type:'boolean'},ingest:{type:'boolean'},benchmark:{type:'boolean'},'refresh-existing':{type:'boolean'},target:{type:'string'},'max-minutes':{type:'string'}}});
const config=readJson(path.join(root,'ops/daily-config.json'));
dotenv.config({path:path.join(root,'server/.env'),quiet:true,override:true});
dotenv.config({path:path.join(root,'.env'),quiet:true});
const target=Number(args.target||config.targetPerSourceCategory);
const minutes=Number(args['max-minutes']||210);
if(!Number.isInteger(target)||target<1||target>100||!Number.isFinite(minutes)||minutes<1||minutes>260) throw new Error('Invalid benchmark or target limits');
if((args.target||args['max-minutes'])&&!args.benchmark) throw new Error('Overrides are only available in benchmark mode');
if(args['refresh-existing']&&!args.benchmark&&!args.ingest) throw new Error('Full rechecks require a no-email ingestion run');
if(config.timeZone!=='Asia/Taipei'||!Array.isArray(config.recipients)||!config.recipients.length||config.recipients.some(r=>typeof r!=='string'||!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(r))||new Set(config.recipients.map(r=>r.toLowerCase())).size!==config.recipients.length) throw new Error('Invalid daily recipient configuration');
const publicUrl=(process.env.NEWSAGG_STABLE_URL||'').replace(/\/$/,'');
if(!/^https:\/\/[^/]+$/.test(publicUrl)) throw new Error('Stable HTTPS public origin is required');
const day=args.ingest?ingestionEdition(new Date(),config.startTime):taipeiDay();
const base=path.join(root,'logs/daily');
const mode=args.benchmark?'benchmark':args['dry-run']?'preflight':args.ingest?'ingestion':'scheduled';
const dir=path.join(base,mode==='scheduled'?day:mode==='ingestion'?`ingestion-${day}`:`${mode}-${Date.now()}`);
fs.mkdirSync(dir,{recursive:true});
const logFile=path.join(dir,'pipeline.log');
function log(event,detail={}) {
  const line=JSON.stringify({at:new Date().toISOString(),event,...detail});
  console.log(line); fs.appendFileSync(logFile,line+'\n');
}
const runCommand=(exe,params,timeout)=>command(exe,params,{cwd:root,logFile,timeout});
const docker=(params,timeout=60000)=>runCommand('docker',params,timeout);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitUntil(time) { while(Date.now()<time.getTime()) await sleep(Math.min(30000,time.getTime()-Date.now())); }
function smtp() {
  if(!process.env.SMTP_HOST||!process.env.SMTP_USER||!process.env.SMTP_PASS) throw new Error('SMTP configuration is incomplete');
  const port=Number(process.env.SMTP_PORT||587);
  return nodemailer.createTransport({host:process.env.SMTP_HOST,port,secure:port===465||['1','true'].includes(process.env.SMTP_SECURE),
    requireTLS:port!==465,auth:{user:process.env.SMTP_USER.trim(),pass:process.env.SMTP_PASS.replace(/\s/g,'')},
    connectionTimeout:15000,greetingTimeout:15000,socketTimeout:30000});
}
function databaseClient() {
  const dsn=process.env.NEONDB_URL||process.env.DATABASE_URL||process.env.NEON_DSN;
  if(!dsn) throw new Error('Database configuration missing');
  const url=new URL(dsn); url.searchParams.delete('sslmode'); url.searchParams.delete('sslrootcert');
  return new pg.Client({connectionString:url.toString(),ssl:['localhost','127.0.0.1','db'].includes(url.hostname)?false:{rejectUnauthorized:true},connectionTimeoutMillis:15000,query_timeout:30000});
}
async function getRows(ids) {
  if(!ids?.length) return [];
  const client=databaseClient();
  try {
    await client.connect();
    return (await client.query(`SELECT a.id,a.title,a.topic,a.source_id,s.name AS source_name,a.published_at,a.ai_summary,
      a.feed_eligible,a.extraction_version,a.content_blocks FROM articles a LEFT JOIN sources s ON s.id=a.source_id
      WHERE a.id = ANY($1::text[]) ORDER BY a.published_at DESC,a.id`,[ids])).rows;
  } finally { await client.end(); }
}

async function morningEdition() {
  const unlock=acquireLock(path.join(base,'delivery.lock'));
  try {
    const ledgerFile=path.join(dir,'delivery.json'),stateFile=path.join(dir,'state.json');
    const ledger=readJson(ledgerFile,{});
    if(config.recipients.every(to=>ledger[to]?.status==='accepted')) {log('already_delivered');return;}
    const freezeAt=taipeiTime(day,config.freezeTime),sendAt=taipeiTime(day,config.sendTime),deadline=taipeiTime(day,config.sendDeadline);
    log('waiting_for_snapshot',{freezeAt});await waitUntil(freezeAt);
    const client=databaseClient();let edition;
    try {await client.connect();edition=await freezeEdition(client,{day,config,publicUrl});}
    finally {await client.end();}
    const message=edition.message;
    const state={day,phase:'frozen',editionDay:day,frozenAt:edition.frozen_at,articleCount:edition.details.articleCount,status:edition.status,details:edition.details};
    atomicJson(stateFile,state);atomicJson(path.join(dir,'preview.json'),message);
    log('edition_frozen',{articleCount:state.articleCount,status:edition.status,lateFreeze:edition.details.lateFreeze});
    await recoverPublic();
    await waitUntil(sendAt);
    if(!await healthy()) await recoverPublic();
    if(Date.now()>deadline.getTime()) log('delivery_late',{deadline});
    const transport=smtp();
    try {
      await transport.verify();
      const send=recipients=>deliver({recipients,ledger,save:v=>atomicJson(ledgerFile,v),transport,message,day,from:process.env.MAIL_FROM||process.env.SMTP_USER});
      await send(config.recipients.filter(to=>!ledger[to]||(ledger[to].status==='rejected'&&ledger[to].attempts<3)));
      while(Date.now()<deadline.getTime()&&config.recipients.some(to=>ledger[to]?.status==='rejected'&&ledger[to].attempts<3)) {
        await sleep(30000);
        await send(config.recipients.filter(to=>ledger[to]?.status==='rejected'&&ledger[to].attempts<3));
      }
      const accepted=config.recipients.every(to=>ledger[to]?.status==='accepted');
      state.phase=accepted?'delivered':'delivery_needs_review';state.finishedAt=new Date().toISOString();atomicJson(stateFile,state);
      log('delivery_result',{acceptedBySMTP:accepted,delivery:ledger,inboxReceiptConfirmed:false});
      if(!accepted) process.exitCode=1;
    } finally {transport.close();}
  } finally {unlock();}
}
async function healthy() {
  try { const r=await fetch(`${publicUrl}/health`,{signal:AbortSignal.timeout(15000),cache:'no-store'});const body=await r.json();return r.ok&&body.ok===true&&body.db==='up'; }
  catch { return false; }
}
async function recoverPublic() {
  if(await healthy()) { log('public_health_ok');return; }
  log('public_recovery_started');
  await docker(['compose','up','-d','--force-recreate','--no-deps','--wait','--wait-timeout','60','tunnel'],90000);
  await runCommand('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(root,'UPDATE-STABLE-ORIGIN.ps1')],210000);
  if(!await healthy()) throw new Error('Public website is unhealthy after tunnel recovery');
  log('public_recovery_ok');
}
async function readyDocker() {
  try { await docker(['info','--format','{{.ServerVersion}}'],15000); }
  catch {
    const candidates=[process.env.PROGRAMFILES&&path.join(process.env.PROGRAMFILES,'Docker/Docker/Docker Desktop.exe'),
      process.env.LOCALAPPDATA&&path.join(process.env.LOCALAPPDATA,'Programs/DockerDesktop/Docker Desktop.exe')].filter(Boolean);
    const desktop=candidates.find(p=>fs.existsSync(p));
    if(!desktop) throw new Error('Docker Desktop is unavailable');
    await runCommand('powershell.exe',['-NoProfile','-Command',`Start-Process -FilePath '${desktop.replace(/'/g,"''")}' -WindowStyle Hidden`],15000);
    let ready=false;
    for(let i=0;i<20;i++) {await sleep(5000);try {await docker(['info'],5000);ready=true;break;}catch{}}
    if(!ready) throw new Error('Docker Desktop did not start');
  }
  await docker(['compose','up','-d','--wait','--wait-timeout','180','server','client','local-ai'],210000);
}

async function main() {
  if(args['dry-run']) {
    // No SMTP DATA, scraping, tunnel rotation, or scheduler mutation.
    await docker(['info','--format','{{.ServerVersion}}']);
    await getRows(['__preflight__']);
    const transport=smtp();try {await transport.verify();}finally {transport.close();}
    const publicHealthy=await healthy();
    log('preflight_complete',{smtpVerified:true,publicHealthy,recipients:config.recipients,target,schedule:config.startTime,sendTime:config.sendTime,noEmailSent:true});
    if(!publicHealthy) process.exitCode=1;
    return;
  }
  if(!args.benchmark&&!args.ingest) return morningEdition();
  const unlock=acquireLock(path.join(base,'pipeline.lock'));
  try {
    const stateFile=path.join(dir,'state.json'),reportFile=path.join(dir,'scraper.json');
    let state=readJson(stateFile,{day,runKey:randomUUID(),createdAt:new Date().toISOString(),phase:'pending'});
    if(state.phase==='complete') {log('ingestion_already_complete');return;}
    const proposedDeadline=args.benchmark?new Date(Date.now()+minutes*60000):new Date(Math.min(new Date(state.createdAt).getTime()+config.maxScrapeMinutes*60000,taipeiTime(day,config.scrapeDeadline).getTime()));
    if(args.ingest) {
      if(state.phase!=='pending') {
        // Ensure the exact previous worker has stopped before creating a new
        // run identity. Preserve its report, including any committed articles.
        await readyDocker();
        let exists=false;
        try {await docker(['inspect','--format','{{.State.Running}}',`newsagg-daily-${state.runKey}`]);exists=true;}catch{}
        if(exists) await docker(['stop','--time','30',`newsagg-daily-${state.runKey}`],45000);
        atomicJson(path.join(dir,`attempt-${state.runKey}.json`),{state,report:readJson(reportFile)});
      }
      state=nextIngestionAttempt(state,{deadline:proposedDeadline});
      atomicJson(stateFile,state);
    }
    const scrapeDeadline=new Date(state.scrapeDeadline||proposedDeadline);
    const save=()=>atomicJson(stateFile,state);
    let error=state.error||null, report=state.phase==='pending'?null:readJson(reportFile), rows=[],validation;
    const container=`newsagg-daily-${state.runKey}`;
    if(state.phase==='pending') {
      state.phase='scraping';save();log('scraper_start',{runKey:state.runKey,target,deadline:scrapeDeadline});
      try {
        if(Date.now()>=scrapeDeadline.getTime()) throw new Error('Scrape start missed the daily cutoff');
        await readyDocker();
        if(args.ingest) {
          try {await recoverPublic();}
          catch {log('public_health_warning',{message:'Ingestion continues; morning delivery still requires healthy public URL'});}
        }
        // Prebuilt image: never spend the nightly time budget downloading/building models.
        await docker(['compose','--profile','scraper','run','--rm','--name',container,'--volume',`${dir}:/reports`,'scraper',
          'python','-u','run_all.py','--target',String(target),'--max-age-hours',String(config.maxAgeHours),
          '--run-key',state.runKey,'--report-path','/reports/scraper.json',...(args['refresh-existing']||args.ingest?['--refresh-existing']:[])],scrapeDeadline.getTime()-Date.now());
        report=readJson(reportFile);
        if(!report?.finishedAt) throw new Error('Scraper exited without a finished report');
      } catch(e) {
        error=e.message;
        try {await docker(['stop','--time','10',container],20000);}catch{}
        report=readJson(reportFile);
      }
      state.phase='prepared';state.error=error;save();
    } else if(state.phase==='scraping') {
      // A lost host process must not silently start a second scraper or reuse
      // an unrelated latest DB run. Stop its exact container before alerting.
      try {await docker(['stop','--time','10',container],20000);}catch{}
      report=readJson(reportFile);
      error='Previous pipeline was interrupted during scraping';
      state.phase='prepared';state.error=error;save();
    }
    try {
      if(!error) {
        rows=await getRows(report?.articleIds);
        validation=validateRun(report,state.runKey,rows,config);
        if(!validation.ok) error=validation.reason;
        else { rows=validation.rows;delete validation.rows; }
      }
    } catch(e) {error=e.message;}
    const message=renderDigest({day,runKey:state.runKey,report,rows,validation,publicUrl,error});
    atomicJson(path.join(dir,'preview.json'),message);
    state.validation=validation;state.error=error;state.articleCount=rows.length;state.reportStatus=report?.status;save();
    log('digest_prepared',{runKey:state.runKey,articleCount:rows.length,status:error?'failed':validation?.status,error});
    state.phase=error?'failed':'complete';state.finishedAt=new Date().toISOString();save();
    log('ingestion_complete',{noEmailSent:true,livePublication:true});if(error)process.exitCode=1;
  } finally {unlock();}
}
main().catch(error=>{log('pipeline_failed',{error:error.message});process.exitCode=1;});
