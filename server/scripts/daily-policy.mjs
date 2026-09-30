import {emailHtml} from './daily-email.mjs';
export function taipeiDay(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
}
export function taipeiTime(day, time) { return new Date(`${day}T${time}:00+08:00`); }
export function validateRun(report, runKey, rows, config, now = new Date()) {
  if (!report || report.runKey !== runKey || !report.finishedAt || !['complete','partial'].includes(report.status)) return {ok:false,reason:'No completed report for this exact run'};
  const start = new Date(report.startedAt).getTime(), finish = new Date(report.finishedAt).getTime();
  if (report.errors !== 0 || !report.startedAt || !Number.isFinite(start) || !Number.isFinite(finish) || finish < start || finish > now.getTime()) return {ok:false,reason:'Run failed or has invalid timestamps'};
  const ids = new Set(report.articleIds || []);
  if (!ids.size || ids.size !== rows.length || new Set(rows.map(r=>r.id)).size !== rows.length) return {ok:false,reason:'Run articles are missing or duplicated'};
  for (const row of rows) {
    const date = new Date(row.published_at).getTime();
    if (!ids.has(row.id) || !Number.isFinite(date) || date < start-config.maxAgeHours*3600000 || date > now.getTime()+7200000 || row.feed_eligible !== true || row.extraction_version !== 'structured-v3' || !Array.isArray(row.content_blocks) || !row.content_blocks.length) return {ok:false,reason:'Run contains an ineligible, old, or unstructured article'};
  }
  // Articles can legitimately age out while waiting for the send window.
  // Exclude them explicitly, but never pull replacement stories from old runs.
  const freshRows=rows.filter(r=>new Date(r.published_at).getTime()>=now.getTime()-config.maxAgeHours*3600000);
  if (freshRows.length < config.minimumArticles || new Set(freshRows.map(r=>r.source_id)).size < config.minimumSources) return {ok:false,reason:'Insufficient fresh articles or source coverage'};
  const deficits = Object.fromEntries(Object.entries(report.counts || {}).filter(([k,v])=>k.startsWith('deficit_') && v>0));
  const expiredCount=rows.length-freshRows.length;
  return {ok:true,status:Object.keys(deficits).length||expiredCount?'partial':report.status,deficits,expiredCount,rows:freshRows};
}
export function shouldSend(entry) {
  // An interrupted DATA transaction may already have reached SMTP. Never
  // blindly retry it and create duplicate mail; an operator must reconcile it.
  return !entry || entry.status === 'rejected';
}
export function deliveryOutcome(info) {
  return info?.accepted?.length ? 'accepted' : 'rejected';
}
export function deliveryError(error) {
  return Number(error?.responseCode)>=400 ? 'rejected' : 'uncertain';
}
export function digestSelection(rows,limit=12,now=new Date()) {
  const groups=new Map(),usedSources=new Map(),selected=[];
  for(const row of rows) {
    if(!groups.has(row.topic)) groups.set(row.topic,[]);
    groups.get(row.topic).push(row);
  }
  while(selected.length<limit&&[...groups.values()].some(g=>g.length)) {
    for(const topic of [...groups.keys()].sort()) {
      const candidates=groups.get(topic);
      candidates.sort((a,b)=>{
        const oldA=Number(new Date(a.published_at).getTime()<now.getTime()-86400000);
        const oldB=Number(new Date(b.published_at).getTime()<now.getTime()-86400000);
        return oldA-oldB||(usedSources.get(a.source_id)||0)-(usedSources.get(b.source_id)||0)||new Date(b.published_at)-new Date(a.published_at);
      });
      if(candidates.length&&selected.length<limit) {
        const row=candidates.shift();selected.push(row);usedSources.set(row.source_id,(usedSources.get(row.source_id)||0)+1);
      }
    }
  }
  return selected.sort((a,b)=>new Date(b.published_at)-new Date(a.published_at));
}
export function renderDigest({day,runKey,report,rows=[],validation,publicUrl,error,now=new Date()}) {
  const failed = Boolean(error) || !validation?.ok;
  const status = failed ? 'FAILED' : validation.status.toUpperCase();
  const subject = `NewsAgg ${day} [${status}] — ${failed?'Daily pipeline alert／每日流程警示':`${rows.length} verified stories／篇已驗證文章`}`;
  const counts = {};
  for(const row of rows) counts[row.topic]=(counts[row.topic]||0)+1;
  const missing = ['Business','Climate','Health','Lifestyle','Politics','Science','Sport','World'].filter(c=>!counts[c]);
  const snapshot=report?.scope==='published-snapshot';
  const topicZh={Business:'商業',Climate:'氣候',Health:'健康',Lifestyle:'生活',Politics:'政治',Science:'科學',Sport:'體育',World:'國際'};
  const text = [subject,`Timezone／時區: Asia/Taipei | Reference／識別碼: ${runKey}`,`${snapshot?'Publication window／發布時段':'Scraper／擷取'}: ${report?.startedAt || 'not started／尚未開始'} → ${report?.finishedAt || 'not completed／尚未完成'}`,
    failed ? `This is a failure notice, not a successful news digest.／此為失敗通知，並非成功發送的新聞摘要。 ${error || validation?.reason}` : `${snapshot?'This frozen edition includes only validated articles already published on the website.／此固定版本僅收錄網站上已發布且驗證的文章。':'Only articles from this completed run are included.／僅收錄本次已完成擷取的文章。'}\n${Object.entries(counts).map(([topic,count])=>`${topic}／${topicZh[topic]||topic}: ${count} stories／篇文章`).join('\n')}\nMissing categories／缺少的分類: ${missing.map(topic=>`${topic}／${topicZh[topic]}`).join(', ') || 'none／無'}.`,
    !failed && Object.keys(validation.deficits || {}).length ? `${snapshot?'The morning edition is frozen／晨間版本已固定':'Scraping finished／擷取已完成'}, but ${Object.keys(validation.deficits).length} source/category targets were not reached. Older articles are not used to fill the gaps.／仍有 ${Object.keys(validation.deficits).length} 個來源或分類未達目標；不以舊文章補足。` : '',
    !failed && validation.expiredCount ? `${validation.expiredCount} run articles expired before sending and were excluded.／${validation.expiredCount} 篇文章在發送前過期並已排除。` : '',
    !failed ? `${rows.filter(r=>new Date(r.published_at)<now.getTime()-86400000).length} articles use the explicitly allowed 24–48 hour fallback window.／${rows.filter(r=>new Date(r.published_at)<now.getTime()-86400000).length} 篇文章使用允許的 24 至 48 小時備選時間範圍。` : '',
    `Website／網站: ${publicUrl}`, ...(!failed ? digestSelection(rows,12,now).map(r=>`${r.topic}／${topicZh[r.topic]||r.topic} | ${r.source_name} | ${r.title}\n${r.ai_summary || ''}\n${publicUrl}/article/${r.id}`):[])].filter(Boolean).join('\n\n');
  return {subject,text,html:emailHtml({day,runKey,report,rows,selected:failed?[]:digestSelection(rows,12,now),validation,publicUrl,error,subject})};
}
