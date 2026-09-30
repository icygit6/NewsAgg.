const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const topics=['Business','Climate','Health','Lifestyle','Politics','Science','Sport','World'];
function excerpt(value,max=280) {
  const text=String(value||'').replace(/\s+/g,' ').trim();
  if(text.length<=max)return text;
  const short=text.slice(0,max);const last=short.lastIndexOf(' ');
  return short.slice(0,last>max*.65?last:max)+'…';
}
function date(value) {
  if(!value)return '';
  const d=new Date(value);
  return Number.isFinite(d.getTime())?new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Taipei',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(d):'';
}
export function emailHtml({day,runKey,report,rows,selected,validation,publicUrl,error,subject}) {
  const failed=Boolean(error)||!validation?.ok;
  const partial=!failed&&validation.status==='partial';
  const snapshot=report?.scope==='published-snapshot';
  const counts=Object.fromEntries(topics.map(topic=>[topic,rows.filter(r=>r.topic===topic).length]));
  const missing=topics.filter(t=>!counts[t]);
  const sources=new Set(rows.map(r=>r.source_id)).size;
  const origin=new URL(publicUrl);
  if(origin.protocol!=='https:'||origin.username||origin.password)throw new Error('Email links require a public HTTPS origin');
  const base=origin.origin;
  const link=id=>`${base}/article/${encodeURIComponent(id)}`;
  const coverage=topics.map(topic=>`<tr><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#475569">${topic}</td><td align="right" style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;font-weight:bold;color:${counts[topic]?'#173a63':'#92400e'}">${counts[topic]||'No fresh story'}</td></tr>`).join('');
  const cards=selected.map((r,i)=>`<tr><td style="padding:0 28px 18px">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e2e8f0;border-radius:12px;background:#ffffff"><tr><td style="padding:22px">
      <p style="margin:0 0 10px;font-size:11px;font-weight:bold;letter-spacing:1px;color:#2563eb">${String(i+1).padStart(2,'0')} &nbsp; ${esc(r.topic).toUpperCase()}</p>
      <h2 style="margin:0 0 10px;font-size:20px;line-height:1.4;font-weight:700"><a href="${esc(link(r.id))}" style="color:#173a63;text-decoration:none">${esc(r.title)}</a></h2>
      <p style="margin:0 0 13px;font-size:12px;color:#64748b">${esc(r.source_name||r.source_id)} &middot; ${esc(date(r.published_at))} Taipei</p>
      ${r.ai_summary?`<p style="margin:0 0 16px;font-size:15px;line-height:1.75;color:#334155">${esc(excerpt(r.ai_summary))}</p>`:''}
      <a href="${esc(link(r.id))}" style="font-size:13px;font-weight:bold;color:#2563eb;text-decoration:none">Read full story &rarr;</a>
    </td></tr></table></td></tr>`).join('');
  const notice=failed
    ? `<strong>Today's pipeline needs attention.</strong><br>This is a failure notice, not a successful news digest. ${esc(error||validation?.reason||'Validation did not pass.')}`
    : partial
      ? `<strong>${snapshot?'Morning edition frozen; coverage is incomplete.':'Scraping finished; coverage is incomplete.'}</strong><br>Only verified, recent stories are included. Some source/category targets were not reached.${missing.length?` No fresh story was collected for ${esc(missing.join(', '))}.`:''}${validation.expiredCount?` ${validation.expiredCount} ${validation.expiredCount===1?'story was':'stories were'} excluded after aging beyond 48 hours.`:''}`
      : `<strong>All configured collection targets were met.</strong><br>${snapshot?'This edition is a fixed selection of already-published stories.':'Every story below belongs to this completed scraper run.'}`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:Arial,'Noto Sans',sans-serif;color:#173a63">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${esc(failed?'Daily pipeline alert':`${rows.length} verified stories across ${sources} sources. ${partial?'Coverage incomplete.':'Full collection targets met.'}`)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef2f7"><tr><td align="center" style="padding:24px 8px">
<table role="presentation" width="640" cellspacing="0" cellpadding="0" style="width:100%;max-width:640px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden">
<tr><td style="padding:30px 28px;background:#173a63;color:#ffffff"><p style="margin:0 0 20px;font-size:15px;font-weight:bold;letter-spacing:2px;color:#93c5fd">NEWSAGG &nbsp; / &nbsp; DAILY BRIEF</p>
<h1 style="margin:0 0 10px;font-size:32px;line-height:1.2;color:#ffffff">${failed?'A quick update.':'Your morning, informed.'}</h1>
<p style="margin:0;font-size:14px;line-height:1.6;color:#cbd5e1">${esc(day)} &nbsp;&middot;&nbsp; Asia/Taipei &nbsp;&middot;&nbsp; ${failed?'FAILED':partial?'PARTIAL COVERAGE':'COMPLETE'}</p></td></tr>
${!failed?`<tr><td style="padding:24px 28px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${[[rows.length,'verified stories'],[sources,'news sources'],[topics.length-missing.length,'categories covered']].map(([n,label])=>`<td width="33%" valign="top" style="padding:0 8px 0 0"><div style="font-size:28px;font-weight:bold;color:#173a63">${n}</div><div style="font-size:12px;line-height:1.5;color:#64748b">${label}</div></td>`).join('')}</tr></table></td></tr>`:''}
<tr><td style="padding:22px 28px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:16px;border-left:4px solid ${failed?'#dc2626':partial?'#d97706':'#059669'};background:${failed?'#fef2f2':partial?'#fffbeb':'#ecfdf5'};font-size:13px;line-height:1.7;color:#475569">${notice}</td></tr></table></td></tr>
${!failed?`<tr><td style="padding:0 28px 18px"><h2 style="font-size:18px;margin:0 0 6px">Today's reading list</h2><p style="margin:0;font-size:13px;line-height:1.6;color:#64748b">${selected.length} selected stories, balanced across available categories and sources. Summary previews; full articles are one click away.</p></td></tr>${cards}
<tr><td style="padding:6px 28px 22px"><h2 style="font-size:18px;margin:0 0 12px">Collection coverage</h2><table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;background:#ffffff"><tr><th align="left" style="padding:10px 12px;font-size:12px;background:#eaf0f8">Category</th><th align="right" style="padding:10px 12px;font-size:12px;background:#eaf0f8">Verified stories</th></tr>${coverage}</table><p style="font-size:12px;line-height:1.6;color:#64748b;margin:12px 0 0">Publication window: up to 48 hours. Older or unverified articles are not used to fill missing targets.</p></td></tr>`:''}
<tr><td align="center" style="padding:4px 28px 28px"><table role="presentation" cellspacing="0" cellpadding="0"><tr><td bgcolor="#2563eb" style="border-radius:8px;padding:14px 22px"><a href="${esc(base)}" style="color:#ffffff;font-weight:bold;font-size:14px;text-decoration:none">Open NewsAgg &rarr;</a></td></tr></table></td></tr>
<tr><td style="padding:20px 28px;border-top:1px solid #e2e8f0;background:#f1f5f9;font-size:11px;line-height:1.8;color:#64748b">NewsAgg &middot; Final project daily brief<br>${snapshot?'Publication window':'Scraper'}: ${esc(date(report?.startedAt))||'not started'} &rarr; ${esc(date(report?.finishedAt))||'not completed'} (Taipei)<br><span style="word-break:break-all">${snapshot?'Edition':'Run'} reference: ${esc(runKey)}</span></td></tr>
</table></td></tr></table></body></html>`;
}
