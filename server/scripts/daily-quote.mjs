// QOTD needs no API token. Freeze the quote with the edition for stable retries.
export function normalizeQuote(value) {
  if(typeof value?.body!=='string'||typeof value?.author!=='string') return null;
  const body=value.body.trim(),author=value.author.trim();
  if(!body||!author||body.length>3000||author.length>200) return null;
  let url='https://favqs.com';
  try {
    const candidate=new URL(value.url);
    if(candidate.protocol==='https:'&&candidate.hostname==='favqs.com'&&!candidate.username&&!candidate.password) url=candidate.href;
  } catch {}
  return {body,author,url};
}
export async function fetchDailyQuote({fetchImpl=globalThis.fetch,timeoutMs=5000}={}) {
  try {
    const response=await fetchImpl('https://favqs.com/api/qotd',{
      headers:{Accept:'application/vnd.favqs.v2+json'},signal:AbortSignal.timeout(timeoutMs),
    });
    if(!response.ok) return null;
    const data=await response.json();
    return data.error_code?null:normalizeQuote(data.quote);
  } catch {return null;} // A quote outage must not prevent news delivery.
}
