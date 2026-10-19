import { describe, expect, it } from 'vitest';
import { imageCandidates, yahooOriginalImage } from './articleImages';

describe('Yahoo image alternatives', () => {
  it('does not unwrap arbitrary hosts, protocols, credentials or malformed escapes', () => {
    const wrap = (url: string) => `https://s.yimg.com/lo/mysterio/api/hash/resize/${encodeURIComponent(url)}`;
    for (const url of ['https://unrelated.com/photo.jpg', 'http://media.zenfs.com/photo.jpg', 'https://user:pass@media.zenfs.com/photo.jpg', 'https://media.zenfs.com:8080/photo.jpg']) expect(yahooOriginalImage(wrap(url))).toBeNull();
    expect(yahooOriginalImage('https://evil.com/lo/mysterio/api/hash/resize/https%3A%2F%2Fmedia.zenfs.com%2Fx.jpg')).toBeNull();
    expect(yahooOriginalImage('https://s.yimg.com/lo/mysterio/api/%broken')).toBeNull();
  });
  it('deduplicates candidates while retaining order and query strings', () => {
    expect(imageCandidates('https://example.com/x?sig=abc', ['https://example.com/x?sig=abc', 'https://example.com/y'])).toEqual(['https://example.com/x?sig=abc', 'https://example.com/y']);
  });
});
