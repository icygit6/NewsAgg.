import {randomUUID} from 'node:crypto';

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
