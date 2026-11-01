import { expect, it } from 'vitest'
import { normalizeByline, reportingAuthors } from './reportingAuthors'
it('counts every distinct article beyond Live View, preserving source and bylines', () => {
  const rows = Array.from({length: 35}, (_, i) => ({id: String(i), author_name: ' Jane  Doe ', source_id: 'bbc', source_name: 'BBC'}));
  const result = reportingAuthors([...rows, rows[0], {id:'cnn',author_name:'Jane Doe',source_id:'cnn',source_name:'CNN'}, {id:'none',author_name:' ',source_id:'bbc',source_name:'BBC'}]);
  expect(result).toEqual([
    {name:'Jane Doe',source:'BBC',count:35,articleId:'0'},
    {name:'Jane Doe',source:'CNN',count:1,articleId:'cnn'},
  ]);
});
it('keeps newsroom credits without manufacturing individual people', () => {
  expect(reportingAuthors([{id:'1',author_name:'BBC Newsroom',source_name:'BBC'}])[0].name).toBe('BBC Newsroom');
  expect(reportingAuthors([{id:'missing'}, {id:'placeholder', author_name:'Unknown'}])).toEqual([]);
});
it('cleans bylines for display: emails, reporter prefixes, datelines and job titles', () => {
  const cases: Array<[string, string]> = [
    ['service@sunmedia.tw (編輯中心)', '編輯中心'],
    ['記者林翊涵／綜合報導', '林翊涵'],
    ['羅惠齡／台北報導', '羅惠齡'],
    ['簡子喬｜Yahoo名人娛樂特派記者', '簡子喬'],
    ['Al Jazeera Staff', 'Al Jazeera Staff'],
    ['news@example.com', ''],
  ];
  for (const [raw, clean] of cases) expect(normalizeByline(raw)).toBe(clean);
});
it('counts one reporter once whatever the byline decoration', () => {
  const result = reportingAuthors([
    { id: 'a', author_name: '記者林翊涵／綜合報導', source_id: 'yahoo_tw', source_name: 'Yahoo Taiwan' },
    { id: 'b', author_name: '林翊涵／台北報導', source_id: 'yahoo_tw', source_name: 'Yahoo Taiwan' },
    { id: 'c', author_name: 'news@example.com', source_id: 'yahoo_tw', source_name: 'Yahoo Taiwan' },
  ]);
  expect(result).toEqual([{ name: '林翊涵', source: 'Yahoo Taiwan', count: 2, articleId: 'a' }]);
});
