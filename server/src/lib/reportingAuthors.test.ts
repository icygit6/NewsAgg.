import { expect, it } from 'vitest'
import { reportingAuthors } from './reportingAuthors'
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
