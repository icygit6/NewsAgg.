/** Keep the account address private when its owner chooses to hide it. */
export const maskEmail = (email: string) => {
  const [name, domain] = email.split('@');
  if (!domain) return '•••';
  return `${name.slice(0, Math.min(2, name.length))}${'•'.repeat(Math.max(3, name.length - 2))}@${domain}`;
};
