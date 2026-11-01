import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {shouldSend,deliveryOutcome,deliveryError} from './daily-policy.mjs';

export function readJson(file, fallback=null) {
  try { return JSON.parse(fs.readFileSync(file,'utf8')); }
  catch(error) { if(error.code==='ENOENT') return fallback; throw error; }
}
export function atomicJson(file,value) {
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(`${file}.tmp`,JSON.stringify(value,null,2),'utf8');
  fs.renameSync(`${file}.tmp`,file);
}
export function acquireLock(file) {
  fs.mkdirSync(path.dirname(file),{recursive:true});
  for(let attempt=0;attempt<2;attempt++) {
    try {
      const fd=fs.openSync(file,'wx');
      fs.writeFileSync(fd,JSON.stringify({pid:process.pid,startedAt:new Date().toISOString()}));
      fs.closeSync(fd);
      return ()=>fs.unlinkSync(file);
    } catch(error) {
      if(error.code!=='EEXIST') throw error;
      const owner=readJson(file);
      if(!Number.isInteger(owner?.pid) || owner.pid<=0) throw new Error('Invalid pipeline lock; operator review required');
      try { process.kill(owner.pid,0); throw new Error('A daily pipeline is already running'); }
      catch(check) { if(check.code!=='ESRCH') throw check; }
      fs.unlinkSync(file);
    }
  }
  throw new Error('Could not acquire pipeline lock');
}
export async function command(executable,args,{cwd,logFile,timeout=60000}={}) {
  if(timeout<=0) throw new Error('Command deadline has passed');
  const output=logFile?fs.openSync(logFile,'a'):null;
  try {
    await new Promise((resolve,reject)=>{
      const child=spawn(executable,args,{cwd,windowsHide:true,stdio:output===null?'ignore':['ignore',output,output]});
      let timedOut=false;
      const timer=setTimeout(()=>{timedOut=true;child.kill();},timeout);
      child.once('error',error=>{clearTimeout(timer);reject(error);});
      child.once('exit',code=>{clearTimeout(timer);code===0&&!timedOut?resolve():reject(new Error(timedOut?'Command deadline exceeded':`${executable} exited ${code}`));});
    });
  } finally { if(output!==null) fs.closeSync(output); }
}
export async function deliver({recipients,ledger,save,transport,message,day,from,personalize,now=()=>new Date()}) {
  // Persist the intent BEFORE entering SMTP DATA, and each response afterwards.
  for(const to of recipients) {
    if(!shouldSend(ledger[to])) continue;
    ledger[to]={status:'sending',at:now().toISOString(),attempts:(ledger[to]?.attempts||0)+1};
    save(ledger);
    try {
      const info=await transport.sendMail({...(personalize?personalize(to,message):message),from,to,messageId:`<newsagg-${day}-${to.replace(/[^a-z0-9]/gi,'-')}@newsagg.local>`});
      ledger[to]={...ledger[to],status:deliveryOutcome(info),at:now().toISOString()};
    } catch(error) {
      ledger[to]={...ledger[to],status:deliveryError(error),at:now().toISOString(),code:error.code||'SMTP_ERROR'};
    }
    save(ledger);
  }
  return recipients.every(to=>ledger[to]?.status==='accepted');
}
