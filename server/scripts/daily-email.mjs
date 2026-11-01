import {normalizeQuote} from './daily-quote.mjs';
import {UNSUBSCRIBE_PLACEHOLDER} from './daily-subscribers.mjs';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sentiments={
  // Chart colors match SentimentChart.tsx; badge colors are the sRGB
  // equivalents of NewsCard.tsx's Tailwind emerald/amber/red light palette.
  positive:{label:'Positive／正面',color:'#007a55',background:'#d0fae5',bar:'#10b981'},
  neutral:{label:'Neutral／中性',color:'#92400e',background:'#fef3c7',bar:'#f59e0b'},
  negative:{label:'Negative／負面',color:'#c10007',background:'#ffe2e2',bar:'#ef4444'},
  unknown:{label:'Unrated／未評分',color:'#677587',background:'#f1f3f5',bar:'#c6cdd5'},
};
export function sentimentKey(row) {
  const key=typeof row.sentiment_type==='string'?row.sentiment_type.trim().toLowerCase():'';
  return ['positive','neutral','negative'].includes(key)?key:'unknown';
}
export function digestStats(rows) {
  const counts={positive:0,neutral:0,negative:0,unknown:0};
  for(const row of rows) counts[sentimentKey(row)]++;
  return {total:rows.length,sources:new Set(rows.map(r=>r.source_id).filter(Boolean)).size,sentiments:counts};
}
function origin(publicUrl) {
  const url=new URL(publicUrl);
  if(url.protocol!=='https:'||url.username||url.password) throw new Error('Email links require a public HTTPS origin');
  return url.origin;
}
function date(value) {
  if(!value)return '';
  const d=new Date(value);
  return Number.isFinite(d.getTime())?new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Taipei',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(d):'';
}
function statusNotice({failed,validation,error}) {
  return failed?`This is a failure notice, not a successful news digest.／此為失敗通知，並非成功發送的新聞摘要。 ${error||validation?.reason||'Validation did not pass.'}`:'';
}

export function emailText({day,runKey,report,rows,selected,validation,publicUrl,error,subject,quote,unsubscribeUrl=UNSUBSCRIBE_PLACEHOLDER}) {
  const failed=Boolean(error)||!validation?.ok,partial=!failed&&validation.status==='partial';
  const stats=digestStats(rows),base=origin(publicUrl),q=normalizeQuote(quote);
  return [subject,`${day} · Asia/Taipei／台北時間`,
    statusNotice({failed,partial,report,rows,validation,error}),
    !failed?`Scraped & verified／已擷取並驗證: ${stats.total} | News sources／新聞來源: ${stats.sources} | Selected headlines／精選標題: ${selected.length}`:'',
    !failed?'Counts cover verified stories in this edition.／統計範圍為本期已驗證新聞。':'',
    !failed?Object.entries(stats.sentiments).filter(([key,n])=>key!=='unknown'||n).map(([key,n])=>`${sentiments[key].label}: ${n}`).join(' | '):'',
    ...(!failed?selected.map((r,i)=>`${i+1}. ${r.title}\n${r.source_name||r.source_id||'Unknown source／未知來源'} | ${sentiments[sentimentKey(r)].label}\n${base}/article/${encodeURIComponent(r.id)}`):[]),
    !failed?(q?`A daily perspective／每日一語\n“${q.body}”\n— ${q.author}\nvia FavQs: ${q.url}`:'Daily quote temporarily unavailable.／每日名言暫時無法取得。'):'',
    `Open NewsAgg／開啟網站: ${base}`,
    !failed&&report?.scope==='published-snapshot'?'This edition includes only validated articles already published on the website.／本期僅收錄網站上已發布且驗證的文章。':'',
    `${report?.scope==='published-snapshot'?'Publication window／發布時段':'Scraper／擷取'}: ${date(report?.startedAt)||'not started／尚未開始'} – ${date(report?.finishedAt)||'not completed／尚未完成'} (Taipei／台北時間)`,
    `Reference／識別碼: ${runKey}`,
    `You receive this because email updates are on for your NewsAgg account. Unsubscribe／取消訂閱: ${unsubscribeUrl}\n你收到此郵件是因為你的 NewsAgg 帳號已開啟電子郵件更新。`,
  ].filter(Boolean).join('\n\n');
}

export function emailHtml({day,runKey,report,rows,selected,validation,publicUrl,error,subject,quote,unsubscribeUrl=UNSUBSCRIBE_PLACEHOLDER}) {
  const failed=Boolean(error)||!validation?.ok,partial=!failed&&validation.status==='partial';
  const base=origin(publicUrl),logo=`${base}/logo-mark-128.png?v=brand-20261031`,q=normalizeQuote(quote),stats=digestStats(rows);
  const notice=statusNotice({failed,partial,report,rows,validation,error});
  const activeSentiments=Object.entries(stats.sentiments).filter(([key,n])=>key!=='unknown'||n);
  const cards=selected.map((r,i)=>{
    const sentiment=sentiments[sentimentKey(r)],link=`${base}/article/${encodeURIComponent(r.id)}`;
    return `<tr><td width="29" valign="top" style="width:29px;padding:16px 0;border-bottom:1px solid #e8edf2;font-size:10px;line-height:24px;color:#8d9baa">${String(i+1).padStart(2,'0')}</td>
      <td valign="top" style="padding:16px 0;border-bottom:1px solid #e8edf2;overflow-wrap:anywhere;word-break:break-word"><a class="story-link" href="${esc(link)}" style="color:#173a63;text-decoration:none;font-size:15px;font-weight:bold;line-height:1.55">${esc(r.title)}</a>
      <p style="margin:8px 0 0;font-size:10px;line-height:1.8;color:#61738a"><strong>${esc(r.source_name||r.source_id||'Unknown source／未知來源')}</strong> &nbsp;·&nbsp; <span style="padding:3px 7px;border-radius:4px;background:${sentiment.background};color:${sentiment.color};font-size:10px;white-space:nowrap">${sentiment.label}</span></p></td>
      </tr>`;
  }).join('');
  const metric=(value,label,first=false)=>`<td width="33%" valign="top" style="padding:${first?'0 8px 0 0':'0 8px'}"><div style="font-size:29px;font-weight:bold;color:#173a63;line-height:1.1">${value}</div><div style="margin-top:7px;font-size:11px;line-height:1.7;color:#65788f">${label}</div></td>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(subject)}</title>
<style>@media only screen and (max-width:480px){.pad{padding-left:22px!important;padding-right:22px!important}.headline{font-size:30px!important}.brand{font-size:18px!important}.edition{font-size:9px!important}}</style></head>
<body style="margin:0;padding:0;background:#eaf0f5;font-family:Arial,'Microsoft JhengHei',sans-serif;color:#173a63">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${esc(failed?'Daily pipeline alert／每日流程警示':`${stats.total} verified stories · ${stats.sources} sources · ${selected.length} headlines／篇精選標題${partial?' · Partial coverage／部分涵蓋':''}`)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eaf0f5"><tr><td align="center" style="padding:24px 12px">
<!--[if mso]><table role="presentation" width="640" align="center"><tr><td><![endif]-->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #dae3ec;border-top:5px solid #173a63;border-radius:16px;overflow:hidden">
<tr><td class="pad" style="padding:28px 32px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td><a href="${esc(base)}" style="text-decoration:none;color:#074174"><img src="${esc(logo)}" width="38" height="38" alt="" style="vertical-align:middle;border:0;margin-right:8px"><span class="brand" style="font-family:Nunito,Arial,'Microsoft JhengHei',sans-serif;font-size:20px;font-weight:bold;vertical-align:middle;color:#074174">NewsAgg</span></a></td><td align="right" class="edition" style="font-size:10px;line-height:1.8;letter-spacing:1px;color:#61738a">THE DAILY BRIEF<br>每日新聞簡報</td></tr></table></td></tr>
<tr><td class="pad" style="padding:0 32px 24px"><p style="margin:0 0 14px;font-size:11px;color:#6d7c8e">${esc(day)} &nbsp;·&nbsp; TAIPEI &nbsp;·&nbsp; ${failed?'FAILED／失敗':partial?'PARTIAL／部分涵蓋':'COMPLETE／已完成'}</p>
<h1 class="headline" style="margin:0 0 10px;font-size:34px;line-height:1.15;letter-spacing:-1px;color:#173a63">${failed?'A quick update.':'A world of news.<br>A moment for you.'}</h1><p style="margin:0 0 18px;font-size:19px;color:#61738a">${failed?'最新狀況':'讀懂世界，從今天開始。'}</p>${!failed?'<p style="margin:0;font-size:12px;line-height:1.7;color:#61738a">Your daily headlines, all in one place.<br>每日精選標題，一次掌握。</p>':''}</td></tr>
${notice?`<tr><td class="pad" style="padding:0 32px 22px"><div style="padding:13px 16px;border-left:3px solid ${failed?'#dc2626':'#d9a34a'};background:${failed?'#fef2f2':'#fffbef'};font-size:12px;line-height:1.7;color:#6b614c">${esc(notice)}</div></td></tr>`:''}
${!failed?`<tr><td class="pad" style="padding:0 32px 24px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f6fa;border:1px solid #e3eaf2;border-radius:10px"><tr><td style="padding:20px">
<p style="margin:0 0 17px;font-size:10px;font-weight:bold;letter-spacing:1px">TODAY AT A GLANCE／今日概覽</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>${metric(stats.total,'Scraped &amp; verified<br>已擷取並驗證',true)}${metric(stats.sources,'News sources<br>新聞來源')}${metric(selected.length,'Selected headlines<br>精選標題')}</tr></table>
<p style="border-top:1px solid #dce4ee;margin:18px 0 10px;padding-top:14px;font-size:11px;line-height:1.7;color:#65788f">Sentiment of this edition／本期新聞情緒分布</p>
${stats.total?`<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>${activeSentiments.filter(([,n])=>n).map(([key,n])=>`<td width="${(n/stats.total*100).toFixed(4)}%" height="7" bgcolor="${sentiments[key].bar}" style="height:7px;font-size:0;line-height:0">&nbsp;</td>`).join('')}</tr></table>`:''}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:9px"><tr>${activeSentiments.map(([key,n])=>`<td valign="top" style="font-size:10px;line-height:1.8;color:${sentiments[key].color}"><strong style="font-size:12px">${n}</strong> ${sentiments[key].label.replace('／','<br>')}</td>`).join('')}</tr></table>
<p style="margin:12px 0 0;font-size:10px;line-height:1.6;color:#718198">Counts cover verified stories in this edition.<br>統計範圍為本期已驗證新聞。</p></td></tr></table></td></tr>
<tr><td class="pad" style="padding:0 32px"><p style="border-top:1px solid #dfe6ed;padding:20px 0 0;margin:0 0 8px;font-size:11px;font-weight:bold;letter-spacing:1px">TODAY’S HEADLINES／今日頭條</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="table-layout:fixed">${cards}</table></td></tr>
<tr><td class="pad" style="padding:26px 32px 23px">${q?`<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5fa;border-left:3px solid #2563eb;border-radius:0 8px 8px 0"><tr><td style="padding:21px 24px"><p style="margin:0 0 12px;font-size:10px;font-weight:bold;letter-spacing:1px;color:#4e6d92">❝ &nbsp; A DAILY PERSPECTIVE／每日一語</p><p style="font-family:Georgia,serif;font-size:24px;line-height:1.4;margin:0 0 14px;color:#173a63">“${esc(q.body)}”</p><p style="font-size:11px;color:#61738a;margin:0;line-height:1.8">— ${esc(q.author)}<br><a href="${esc(q.url)}" style="font-size:10px;color:#3f6796;text-decoration:none">via FavQs</a></p></td></tr></table>`:'<p style="margin:0;font-size:11px;line-height:1.7;color:#718198">Daily quote temporarily unavailable.／每日名言暫時無法取得。</p>'}</td></tr>`:''}
<tr><td class="pad" align="center" style="padding:0 32px 26px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" bgcolor="#173a63" style="border-radius:8px"><a href="${esc(base)}" style="display:block;padding:14px 12px;color:#ffffff;font-size:13px;font-weight:bold;line-height:26px;text-decoration:none"><img src="${esc(logo)}" width="26" height="26" alt="" style="background:#ffffff;border-radius:5px;border:0;vertical-align:middle;margin-right:10px">Open NewsAgg／開啟網站</a></td></tr></table><p style="margin:11px 0 0;font-size:10px;color:#8090a1">More stories. A wider perspective.／更多新聞，更廣視野。</p></td></tr>
<tr><td class="pad" align="center" style="padding:18px 32px;border-top:1px solid #e6ecf1;background:#fbfcfd;font-size:10px;line-height:1.9;color:#8290a1"><strong style="color:#586e88">NewsAgg</strong> &nbsp;·&nbsp; Your daily window to the world.<br>Morning edition／晨間簡報 &nbsp;·&nbsp; Asia/Taipei<br>${report?.scope==='published-snapshot'?'Publication window／發布時段':'Scraper／擷取'}: ${esc(date(report?.startedAt))||'not started／尚未開始'} – ${esc(date(report?.finishedAt))||'not completed／尚未完成'}<br><span style="word-break:break-all">Reference／識別碼: ${esc(runKey)}</span><br>You receive this because email updates are on for your account.／你收到此郵件是因為你的帳號已開啟電子郵件更新。<br><a href="${esc(unsubscribeUrl)}" style="color:#586e88">Unsubscribe／取消訂閱</a></td></tr>
</table><!--[if mso]></td></tr></table><![endif]--></td></tr></table></body></html>`;
}
