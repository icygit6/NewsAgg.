#!/usr/bin/env node
// Daily dump of the local Docker PostgreSQL (compose service "db") into backups/.
// Keeps the newest KEEP dumps named newsagg-*.dump; other files are never touched.
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','..');
const dir=path.join(root,'backups');
const logFile=path.join(root,'logs','db-backup.log');
const KEEP=14;

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
  const old=fs.readdirSync(dir).filter(f=>/^newsagg-\d{8}-\d{4}\.dump$/.test(f)).sort().slice(0,-KEEP);
  for(const f of old) fs.unlinkSync(path.join(dir,f));
  log(`ok ${path.basename(target)} ${fs.statSync(target).size} bytes, ${tables} tables, pruned ${old.length}`);
  console.log(JSON.stringify({ok:true,file:target,tables,pruned:old.length}));
} catch(error) {
  fs.rmSync(partial,{force:true});
  log(`failed ${error.message}`);
  console.error(error.message);
  process.exit(1);
}
