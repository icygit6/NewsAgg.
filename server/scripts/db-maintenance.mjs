#!/usr/bin/env node
// Weekly database maintenance: back up first, then cleanse.
//   1. pg_dump via db-backup.mjs (only the newest dump is kept in backups/).
//   2. scraper/cleanup.py --commit --vacuum inside the scraper image, using the
//      repository's current cleanup.py and protected-evaluation-ids.txt.
// Cleansing never runs unless the backup succeeded, and it waits while a
// daily ingestion container is still running. Log: logs/db-maintenance.log.
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','..');
const logFile=path.join(root,'logs','db-maintenance.log');
const dryRun=process.argv.includes('--dry-run');

const log=message=>{
  fs.mkdirSync(path.dirname(logFile),{recursive:true});
  fs.appendFileSync(logFile,`${new Date().toISOString()} ${message}\n`);
  console.log(message);
};

function run(command,args,{env}={}) {
  return new Promise((resolve,reject)=>{
    const child=spawn(command,args,{cwd:root,env:{...process.env,...env},stdio:['ignore','pipe','pipe']});
    let out='';
    child.stdout.on('data',c=>{out+=c;});
    child.stderr.on('data',c=>{out+=c;});
    child.on('error',reject);
    child.on('close',code=>code===0?resolve(out):reject(new Error(`${command} ${args.join(' ')} exited ${code}: ${out.trim().slice(-800)}`)));
  });
}

try {
  const ingesting=(await run('docker',['ps','--filter','name=newsagg-daily-','--format','{{.Names}}'])).trim();
  if(ingesting) throw new Error(`ingestion still running (${ingesting}); retry later`);

  if(!dryRun) {
    const backup=await run(process.execPath,[path.join(root,'server','scripts','db-backup.mjs')]);
    log(`backup ${backup.trim()}`);
  }

  const mount=(file)=>['-v',`${path.join(root,'scraper',file)}:/app/${file}:ro`];
  const cleanup=await run('docker',['compose','--profile','scraper','run','--rm','--no-deps',
    ...mount('cleanup.py'),...mount('protected-evaluation-ids.txt'),
    '--entrypoint','python','scraper','cleanup.py',...(dryRun?[]:['--commit','--vacuum'])]);
  const summary=cleanup.split('\n').filter(line=>/^(Protected|  \w|Deleted|DRY RUN|VACUUM)/.test(line)).join(' | ');
  log(`${dryRun?'dry-run':'cleanup'} ${summary}`);
} catch(error) {
  log(`failed ${error.message}`);
  process.exit(1);
}
