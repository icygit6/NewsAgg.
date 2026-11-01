import {createHash,createHmac} from 'node:crypto';

// Connects the "Email updates" switch (users.email_updates) to the morning
// edition. Until this existed the switch was stored and never read, so people
// who opted in received nothing.

export const UNSUBSCRIBE_PLACEHOLDER='{{UNSUBSCRIBE_URL}}';
const emailPattern=/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
// Gmail SMTP allows ~500 messages a day, shared with verification and reset
// mail. Leave room for those and for the team list.
export const DEFAULT_SUBSCRIBER_LIMIT=400;

/** Same derivation as server/src/lib/unsubscribeToken.ts. */
export function unsubscribeKey(env=process.env) {
  const secret=env.SECRET_KEY||env.JWT_SECRET;
  if(!secret) throw new Error('SECRET_KEY or JWT_SECRET is required to sign unsubscribe links');
  return createHash('sha256').update(`newsagg-unsubscribe:${secret}`).digest();
}
export function signUnsubscribeToken(userId,key) {
  const id=Number(userId);
  if(!Number.isSafeInteger(id)||id<=0) throw new Error('Invalid user id');
  return `${id}.${createHmac('sha256',key).update(`unsubscribe:${id}`).digest('base64url')}`;
}
export function unsubscribeUrl(publicUrl,userId,key) {
  return `${publicUrl.replace(/\/$/,'')}/api/email/unsubscribe?token=${signUnsubscribeToken(userId,key)}`;
}

export function subscriberLimit(env=process.env) {
  const value=Number(env.NEWSLETTER_MAX_SUBSCRIBERS);
  return Number.isInteger(value)&&value>0?value:DEFAULT_SUBSCRIBER_LIMIT;
}

/** Verified accounts that switched email updates on. An unverified address may
 * be a typo or somebody else's, so it is never mailed. */
export async function loadSubscribers(client,{limit=DEFAULT_SUBSCRIBER_LIMIT}={}) {
  const {rows}=await client.query(
    'SELECT id,email FROM users WHERE email_updates = true AND email_verified = true AND email IS NOT NULL ORDER BY id LIMIT $1',[limit]);
  const seen=new Set(),result=[];
  for(const {id,email} of rows) {
    const address=String(email).trim(),key=address.toLowerCase();
    if(!emailPattern.test(address)||seen.has(key)) continue;
    seen.add(key);result.push({id,email:address});
  }
  return result;
}

/** Team recipients first (they decide whether the run succeeded), then
 * subscribers who are not already on that list. */
export function planRecipients(configured,subscribers) {
  const team=new Set(configured.map(address=>address.toLowerCase()));
  const extra=subscribers.filter(subscriber=>!team.has(subscriber.email.toLowerCase()));
  return {team:configured,subscribers:extra,
    byEmail:new Map(subscribers.map(subscriber=>[subscriber.email.toLowerCase(),subscriber]))};
}

/** Per-recipient copy: its own unsubscribe link and, for real subscribers, the
 * RFC 8058 one-click headers that mail clients show as an "Unsubscribe" button. */
export function personalizeMessage(message,{unsubscribeUrl:url,oneClick=false}) {
  const swap=text=>typeof text==='string'?text.split(UNSUBSCRIBE_PLACEHOLDER).join(url):text;
  return {...message,html:swap(message.html),text:swap(message.text),
    headers:{...message.headers,...(oneClick?{'List-Unsubscribe':`<${url}>`,'List-Unsubscribe-Post':'List-Unsubscribe=One-Click'}:{})}};
}
