// Known scraped navigation fragments, not editorial keywords.
const BOILERPLATE = new Set(['設為首選來源在', 'http', 'https', 'list']);
export function isEditorialKeyword(value: string): boolean {
  const keyword = value.trim();
  return keyword.length > 1 && keyword.length <= 40 && !BOILERPLATE.has(keyword.toLowerCase()) && !/^https?:\/\//i.test(keyword);
}
