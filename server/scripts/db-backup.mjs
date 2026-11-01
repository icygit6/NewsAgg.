#!/usr/bin/env node
// Dump of the local Docker PostgreSQL (compose service "db") into backups/. Run by
// db-maintenance.mjs on every other Sunday, right before the cleanup.
// Keeps only the newest KEEP (default 1) dumps named newsagg-*.dump: once the new dump is
// written and checked, older ones are deleted. Other files (e.g. neon-*.dump) are never touched.
// NEWSAGG_BACKUP_COPY_DIR (optional) names a second folder, ideally on another disk or a
// synced drive, that receives a copy of each validated dump and is pruned the same way.
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','..');
const dir=path.join(root,'backups');
const logFile=path.join(root,'logs','db-backup.log');
// One backup is kept: each new, validated dump replaces the previous ones. Both callers use this default.
const KEEP=Math.max(1,Number(process.env.NEWSAGG_BACKUP_KEEP)||1);
const copyDir=process.env.NEWSAGG_BACKUP_COPY_DIR?.trim();
const DUMP=/^newsagg-\d{8}-\d{4}\.dump$/;
const prune=folder=>{
  const old=fs.readdirSync(folder).filter(f=>DUMP.test(f)).sort().slice(0,-KEEP);
  for(const f of old) fs.unlinkSync(path.join(folder,f));
  return old.length;
};

const log=message=>{
  fs.mkdirSync(path.dirname(logFile),{recursive:true});
  fs.appendFileSync(logFile,`${new Date().toISOString()} ${message}\n`);
};

// Runs a command with stdin from a file (optional) and stdout to a file or a buffer.
function run(args,{input,output}={}) {
  return new Promise((resolve,reject)=>{
    const child=spawn('docker',args,{cwd:root,stdio:[input?'pipe':'ignore','pipe','pipe']});
    const chunks=[];let stderr='';
    if(output) child.stdout.pipe(output); else child.stdout.on('data',c=>chunks.push(c));
    child.stderr.on('data',c=>{stderr+=c;});
    // pg_restore --list stops reading once it has the table of contents; an
    // early-closed stdin is expected, so pipe errors are ignored here.
    if(input) {
      child.stdin.on('error',()=>{});
      fs.createReadStream(input).on('error',reject).pipe(child.stdin);
    }
    child.on('error',reject);
    child.on('close',code=>code===0?resolve(Buffer.concat(chunks).toString()):reject(new Error(`docker ${args.join(' ')} exited ${code}: ${stderr.trim()}`)));
  });
}

const stamp=new Date().toLocaleString('sv-SE',{timeZone:'Asia/Taipei'}).replace(/[-:]/g,'').replace(' ','-').slice(0,13);
const target=path.join(dir,`newsagg-${stamp}.dump`);
const partial=`${target}.partial`;
try {
  fs.mkdirSync(dir,{recursive:true});
  const out=fs.createWriteStream(partial);
  await run(['compose','exec','-T','db','pg_dump','-U','newsagg','-d','newsagg','--format=custom','--no-owner','--no-privileges'],{output:out});
  await new Promise(resolve=>out.close(resolve));
  const head=fs.readFileSync(partial).subarray(0,5).toString();
  if(head!=='PGDMP') throw new Error('Dump does not start with the PGDMP signature');
  const toc=await run(['compose','exec','-T','db','pg_restore','--list'],{input:partial});
  const tables=(toc.match(/ TABLE DATA /g)||[]).length;
  if(tables<10) throw new Error(`Dump lists only ${tables} tables`);
  fs.renameSync(partial,target);
  const pruned=prune(dir);
  let copy=null;
  if(copyDir) {
    // A failed copy is logged but does not fail the backup: the primary dump is already valid.
    try {
      fs.mkdirSync(copyDir,{recursive:true});
      copy=path.join(copyDir,path.basename(target));
      fs.copyFileSync(target,`${copy}.partial`);
      if(fs.statSync(`${copy}.partial`).size!==fs.statSync(target).size) throw new Error('copy size differs');
      fs.renameSync(`${copy}.partial`,copy);
      prune(copyDir);
    } catch(error) {
      fs.rmSync(`${copy}.partial`,{force:true});
      log(`copy failed ${copyDir}: ${error.message}`);
      copy=null;
    }
  }
  log(`ok ${path.basename(target)} ${fs.statSync(target).size} bytes, ${tables} tables, pruned ${pruned}${copy?`, copied to ${copyDir}`:''}`);
  console.log(JSON.stringify({ok:true,file:target,copy,tables,pruned}));
} catch(error) {
  fs.rmSync(partial,{force:true});
  log(`failed ${error.message}`);
  console.error(error.message);
  process.exit(1);
}
