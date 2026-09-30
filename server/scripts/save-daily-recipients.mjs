import {parseRecipients,uniqueRecipients} from './daily-recipients.mjs';

const manual=process.argv[2];
if(!manual?.trim()) throw new Error('Enter at least one recipient before saving');
const additions=parseRecipients(manual);
const saved=parseRecipients(process.env.REPORT_EMAIL_TO||'');
console.log(uniqueRecipients(saved,additions).join(','));
