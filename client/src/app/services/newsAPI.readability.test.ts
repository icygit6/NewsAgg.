import { afterEach, expect, it, vi } from 'vitest';
import { fetchArticleById } from './newsAPI';
afterEach(() => vi.unstubAllGlobals());
it('preserves database nulls and parses numeric strings at the API boundary', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok:true, json:async () => ({success:true,data:{id:'test',topic:'World',flesch_score:null,flesch_kincaid:'8.25',smog_index:null}}) }));
  const article = await fetchArticleById('test');
  expect(article?.readability).toMatchObject({fleschScore:null,fleschKincaid:8.25,smogIndex:null});
});
it('preserves missing toxicity and keeps a genuine zero', async () => {
  const fetch = vi.fn().mockResolvedValueOnce({ ok:true, json:async () => ({success:true,data:{id:'missing',topic:'World',toxicity_score:null}}) })
    .mockResolvedValueOnce({ ok:true, json:async () => ({success:true,data:{id:'zero',topic:'World',toxicity_score:'0'}}) });
  vi.stubGlobal('fetch', fetch);
  expect((await fetchArticleById('missing'))?.toxicity.score).toBeNull();
  expect((await fetchArticleById('zero'))?.toxicity.score).toBe(0);
});
