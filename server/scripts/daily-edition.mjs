import {taipeiTime,taipeiDay,digestSelection,renderDigest} from './daily-policy.mjs';
import {fetchDailyQuote} from './daily-quote.mjs';
import {digestStats} from './daily-email.mjs';

export function ingestionEdition(now=new Date(),startTime='17:00') {
  const today=taipeiDay(now);
  return now>=taipeiTime(today,startTime)?taipeiDay(new Date(now.getTime()+86400000)):today;
}
export function editionWindow(day,config) {
  const cutoff=taipeiTime(day,config.freezeTime);
  const previous=taipeiDay(new Date(taipeiTime(day,'12:00').getTime()-86400000));
  return {cutoff,start:taipeiTime(previous,config.startTime)};
}
export function assessEdition(rows,config) {
  const deficits={};
  for(const [source,topics] of Object.entries(config.sourceCategories)) {
    for(const topic of topics) {
      const missing=Math.max(0,config.targetPerSourceCategory-rows.filter(r=>r.source_id===source&&r.topic===topic).length);
      if(missing) deficits[`deficit_${source}_${topic}`]=missing;
    }
  }
  if(rows.length<config.minimumArticles||new Set(rows.map(r=>r.source_id)).size<config.minimumSources) {
    return {ok:false,status:'failed',reason:'Insufficient newly validated published articles for the morning edition',deficits};
  }
  return {ok:true,status:Object.keys(deficits).length?'partial':'complete',deficits,expiredCount:0};
}

// The immutable message (not just article IDs) is stored in PostgreSQL. Later
// scraping, template edits, retries or process restarts cannot alter this edition.
export async function freezeEdition(client,{day,config,publicUrl,now=new Date(),loadQuote=fetchDailyQuote}) {
  const {cutoff,start}=editionWindow(day,config);
  if(now<cutoff) throw new Error('Cannot freeze the morning edition before its cutoff');
  await client.query('BEGIN');
  try {
    await client.query('SELECT pg_advisory_xact_lock(731907, hashtext($1))',[day]);
    const existing=await client.query('SELECT * FROM public.newsletter_editions WHERE edition_day=$1',[day]);
    if(existing.rows.length) {await client.query('COMMIT');return existing.rows[0];}
    const result=await loadEditionRows(client,{day,config});
    const validation=assessEdition(result.rows,config);
    const selected=digestSelection(result.rows,12,cutoff);
    const report={scope:'published-snapshot',startedAt:start.toISOString(),finishedAt:cutoff.toISOString()};
    const quote=validation.ok?await loadQuote():null;
    const message=renderDigest({day,runKey:`edition-${day}`,report,rows:result.rows,validation,publicUrl,now:cutoff,quote});
    const details={articleCount:result.rows.length,sourceCount:new Set(result.rows.map(r=>r.source_id)).size,
      validation,quote,sentiments:digestStats(result.rows).sentiments,windowStart:start.toISOString(),cutoff:cutoff.toISOString(),lateFreeze:now.getTime()-cutoff.getTime()>60000,
      counts:Object.fromEntries([...new Set(result.rows.map(r=>r.topic))].map(t=>[t,result.rows.filter(r=>r.topic===t).length]))};
    const saved=await client.query(`INSERT INTO public.newsletter_editions(edition_day,scheduled_cutoff,status,selected_ids,details,message)
      VALUES($1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb) RETURNING *`,[day,cutoff,validation.status,JSON.stringify(selected.map(r=>r.id)),JSON.stringify(details),JSON.stringify(message)]);
    await client.query('COMMIT');return saved.rows[0];
  } catch(error) {await client.query('ROLLBACK');throw error;}
}

// Shared by the real edition and read-only visual preview; same eligibility gate.
export async function loadEditionRows(client,{day,config}) {
  const {start,cutoff}=editionWindow(day,config);
  return client.query(`SELECT a.id,a.title,a.topic,a.source_id,s.name AS source_name,a.published_at,a.sentiment_type
    FROM public.articles a JOIN public.article_publications p ON p.article_id=a.id AND p.content_hash=a.content_hash
    LEFT JOIN public.sources s ON s.id=a.source_id
    WHERE a.feed_eligible=true AND a.extraction_version='structured-v3'
    AND jsonb_array_length(a.content_blocks)>0 AND NULLIF(btrim(a.ai_summary),'') IS NOT NULL
    AND p.approved_at >= $1 AND p.approved_at <= $2
    AND a.published_at >= $2::timestamptz-($3 * interval '1 hour') AND a.published_at <= $2::timestamptz+interval '2 hours'
    ORDER BY a.published_at DESC,a.id LIMIT 2000`,[start,cutoff,config.maxAgeHours]);
}
