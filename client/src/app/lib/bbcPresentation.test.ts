import { expect, it } from 'vitest';
import { cleanBBCCaption, cleanBBCPresentation, cleanBBCText } from './bbcPresentation';
import type { NewsArticle } from '../types/article';

it.each(['Published 2 hours ago', 'Published Just now', 'Published, 1 minute ago', 'Updated 3 days ago', 'Published\n2 hours ago'])('removes only relative publication UI: %s', label => {
  expect(cleanBBCText(`${label}\n\nThe actual reporting stays intact.`)).toBe('The actual reporting stays intact.');
});

it('preserves reporting that mentions publication or time', () => {
  const prose = 'Published research found a measurable improvement.\n\nTwo hours ago, officials announced the decision.';
  expect(cleanBBCText(prose)).toBe(prose);
  expect(cleanBBCCaption('Image caption, A player celebrates.')).toBe('A player celebrates.');
  expect(cleanBBCCaption('Image caption: A player celebrates.')).toBe('A player celebrates.');
  expect(cleanBBCCaption('Image captioning technology is advancing.')).toBe('Image captioning technology is advancing.');
});

it('cleans stored BBC blocks and gallery captions without changing dates or evidence', () => {
  const article = {
    source: { id: 'bbc', name: 'BBC' }, content: 'Published 5 minutes ago\n\nOriginal reporting.',
    publishedAt: '2026-10-23T12:00:00Z', contentHash: 'original-hash',
    images: [{ url: 'https://example.com/photo.jpg', caption: 'Image caption, Real caption.' }],
    contentBlocks: [{ type: 'paragraph', text: 'Published Just now' }, { type: 'caption', text: 'Image caption, Real caption.' }, { type: 'paragraph', text: 'Original reporting.' }],
  } as NewsArticle;
  const cleaned = cleanBBCPresentation(article);
  expect(cleaned.contentBlocks).toHaveLength(2);
  expect(cleaned.images[0].caption).toBe('Real caption.');
  expect(cleaned.publishedAt).toBe(article.publishedAt);
  expect(cleaned.contentHash).toBe(article.contentHash);
  expect(article.contentBlocks?.[0].text).toBe('Published Just now');
  const other = { ...article, source: { ...article.source, id: 'cnn', name: 'CNN' } };
  expect(cleanBBCPresentation(other)).toBe(other);
});
