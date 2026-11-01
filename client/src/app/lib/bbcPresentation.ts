import { matchSourceId } from '../constants';
import type { NewsArticle } from '../types/article';

// Only standalone publisher UI labels, never prose mentioning publication.
const relativePublication = /^(?:(?:Published|Updated|Last updated)\s*,?\s*)?(?:just now|today|yesterday|(?:less than\s+)?(?:\d+|a|an|one)\s+(?:seconds?|minutes?|hours?|days?|weeks?|months?|years?)(?:\s+(?:and\s+)?\d+\s+(?:seconds?|minutes?|hours?|days?))?\s+ago)\s*[.!]?$/i;
const standalonePublication = /^(?:Published|Updated|Last updated)\s*[:,]?$/i;

export const cleanBBCText = (text: string): string => text.split(/\r?\n/)
  .filter(line => !relativePublication.test(line.trim()) && !standalonePublication.test(line.trim()))
  .join('\n').replace(/\n{3,}/g, '\n\n').trim();

export const cleanBBCCaption = (text: string): string => text.replace(/^\s*Image\s+caption\b\s*[,，:：]?\s*/i, '').trim();

/** Clean reader-facing fields on old rows without rewriting stored extraction
 * evidence, publication timestamps, hashes, or calculated NLP metrics. */
export function cleanBBCPresentation(article: NewsArticle): NewsArticle {
  if (matchSourceId(article.source) !== 'bbc') return article;
  return {
    ...article,
    description: article.description ? cleanBBCText(article.description) : article.description,
    content: cleanBBCText(article.content || ''),
    aiSummary: article.aiSummary ? cleanBBCText(article.aiSummary) : article.aiSummary,
    images: article.images.map(image => ({ ...image, caption: image.caption ? cleanBBCCaption(image.caption) : image.caption })),
    contentBlocks: article.contentBlocks?.map(block => block.type === 'list'
      ? { ...block, items: block.items?.map(cleanBBCText).filter(Boolean) }
      : { ...block, text: block.type === 'caption' ? cleanBBCCaption(block.text || '') : cleanBBCText(block.text || '') })
      .filter(block => block.type === 'list' ? Boolean(block.items?.length) : Boolean(block.text)),
  };
}
