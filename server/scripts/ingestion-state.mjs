import {randomUUID} from 'node:crypto';

// The worker must finish its current article and persist its report BEFORE
// the host deadline. Keep the original hard deadline unchanged on retries.
export function planScraperBudget(deadline,{now=new Date()}={}) {
  const hard=new Date(deadline).getTime(), remaining=hard-now.getTime();
  if(!Number.isFinite(hard)||!Number.isFinite(remaining)||remaining<=5000) throw new Error('Insufficient time to start scraper safely');
  const reserveMs=Math.min(10*60000,Math.max(5000,Math.floor(remaining*0.1)));
  return {stopAt:new Date(hard-reserveMs),deadline:new Date(hard),reserveMs};
}

// Completion is different from filling every quota: a fully processed run can
// legitimately be partial when publishers have too few eligible stories.
export function assertCompletedIngestion(state,report,{day,cutoff}) {
  const finished=new Date(state?.finishedAt).getTime();
  const reportFinished=new Date(report?.finishedAt).getTime();
  const reportStarted=new Date(report?.startedAt).getTime();
  if(state?.day!==day || state.phase!=='complete' || state.error || state.validation?.ok!==true ||
    !state.runKey || report?.runKey!==state.runKey || report.errors!==0 ||
    !['complete','partial'].includes(report.status) || !Number.isFinite(reportStarted) ||
    !Number.isFinite(reportFinished) || !Number.isFinite(finished) ||
    reportFinished<reportStarted || finished<reportFinished || finished>cutoff.getTime()) {
    throw new Error('Email held: this edition requires a successfully completed ingestion run before its preparation time');
  }
  return {runKey:state.runKey,status:report.status,finishedAt:state.finishedAt};
}

// Retries share the ORIGINAL time budget; restarting the process must not
// extend scraping into the morning freeze or create an unbounded retry loop.
export function nextIngestionAttempt(state,{now=new Date(),deadline,maxAttempts=3}={}) {
  if(state.phase==='complete') return state;
  const fixedDeadline=state.scrapeDeadline || deadline.toISOString();
  const attempt=state.attempt || 1;
  if(now.getTime()>=new Date(fixedDeadline).getTime()) throw new Error('Ingestion time budget exhausted');
  if(state.phase==='pending') return {...state,attempt,scrapeDeadline:fixedDeadline};
  if(attempt>=maxAttempts) throw new Error('Ingestion retry limit reached; operator review required');
  return {day:state.day,createdAt:state.createdAt,runKey:randomUUID(),phase:'pending',
    attempt:attempt+1,scrapeDeadline:fixedDeadline,
    history:[...(state.history||[]),{runKey:state.runKey,phase:state.phase,error:state.error||'Interrupted host process',at:now.toISOString()}]};
}
