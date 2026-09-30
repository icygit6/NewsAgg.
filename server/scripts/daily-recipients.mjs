const emailPattern=/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

export function parseRecipients(value) {
  const addresses=(Array.isArray(value)?value:String(value??'').split(/[,;]/))
    .map(address=>String(address).trim()).filter(Boolean);
  if(addresses.length>50||addresses.some(address=>!emailPattern.test(address)))
    throw new Error('Invalid daily recipient configuration');
  return addresses;
}

export function uniqueRecipients(...groups) {
  const seen=new Set();
  const result=[];
  for(const group of groups) for(const address of parseRecipients(group)) {
    const key=address.toLowerCase();
    if(!seen.has(key)) {seen.add(key);result.push(address);}
  }
  if(result.length>50) throw new Error('Too many daily recipients');
  return result;
}

export function resolveRecipients(configured,persisted='',manual='') {
  const baseline=uniqueRecipients(configured,parseRecipients(persisted));
  if(!baseline.length) throw new Error('Daily recipient configuration is empty');
  if(String(manual??'').trim()) {
    const selected=uniqueRecipients(parseRecipients(manual));
    if(!selected.length) throw new Error('Manual recipient list is empty');
    return selected;
  }
  return baseline;
}
