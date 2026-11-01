import { useUiText } from '../../i18n/uiText';
import { Sparkles } from 'lucide-react';
import { ImageWithFallback } from '../utils/ImageWithFallback';
import { VideoPlayer } from '../utils/VideoPlayer';
import type { NewsArticle } from '../../types/article';
import { bodyTextClass, mutedTextClass, panelBaseClass } from './helpers';

interface ArticleBodyProps {
  article: NewsArticle;
  isDark: boolean;
}

function imageIdentity(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.endsWith('.bbci.co.uk') && parsed.pathname.includes('/cpsprodpb/')) {
      return `bbc-image:${parsed.pathname.split('/cpsprodpb/')[1]}`;
    }
  } catch { /* Keep malformed or relative URLs unchanged for the fallback. */ }
  return url;
}

export function ArticleBody({ article, isDark }: ArticleBodyProps) {
  const ui = useUiText();
  const panelBase = panelBaseClass(isDark);
  const mutedText = mutedTextClass(isDark);
  const bodyText = bodyTextClass(isDark);
  const seenImages = new Set([imageIdentity(article.urlToImage || '')]);
  const galleryImages = article.images.filter((image) => {
    const identity = imageIdentity(image.url);
    if (seenImages.has(identity)) return false;
    seenImages.add(identity);
    return true;
  }).slice(0, 3);

  // Strip leading description from content if the content begins with it
  const desc = article.description?.trim() ?? '';
  const rawContent = article.content ?? '';
  const bodyContent = desc && rawContent.trimStart().startsWith(desc)
    ? rawContent.trimStart().slice(desc.length).trimStart()
    : rawContent;

  return (
    <>
      {article.qualityVerified === false && <p role="note" className={`rounded-xl border border-amber-400/40 p-3 mb-5 text-sm ${bodyText}`}>{ui("Archived extraction: this article has not passed the current feed quality checks. You can read the original publisher version using the source link below.")}</p>}
      {article.description && <p className={`text-lg leading-relaxed mb-5 ${bodyText}`}>{article.description}</p>}
      {article.videoUrl && <VideoPlayer videoUrl={article.videoUrl} title={article.title} isDark={isDark} />}

      {article.aiSummary && (
        <div className={`rounded-2xl border p-5 mb-6 ${panelBase}`}>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={15} className="text-blue-600 dark:text-blue-400" />
            <h2 className={`text-lg font-semibold ${isDark ? 'text-slate-100' : 'text-gray-900'}`}>{ui("Extractive summary")}</h2>
          </div>
          <div className={`space-y-2 leading-relaxed ${bodyText}`}>{article.aiSummary.split('\n').filter(Boolean).map((line, i) => <p key={i}>{line}</p>)}</div>
          {article.summaryMethod?.startsWith('extractive') && <p className={`mt-3 text-xs ${mutedText}`}>{ui("Key passages selected from the article.")}</p>}
        </div>
      )}

      {galleryImages.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          {galleryImages.map((image) => (
            <a key={image.url} href={image.url} target="_blank" rel="noopener noreferrer" className={`rounded-2xl overflow-hidden border block ${isDark ? 'border-slate-700/50 bg-slate-800/60' : 'border-gray-100 bg-white/70'}`}>
              <div className="aspect-[4/3] overflow-hidden">
                <ImageWithFallback src={image.url} alt={image.alt || article.title} className="w-full h-full object-cover" />
              </div>
              {image.caption && <p className={`px-3 py-2 text-xs leading-relaxed ${mutedText}`}>{image.caption}</p>}
            </a>
          ))}
        </div>
      )}

      <div className={`article-body space-y-5 leading-relaxed mb-8 ${bodyText}`} style={{ fontSize: '1rem', lineHeight: '1.8', overflowWrap: 'anywhere' }}>
        {article.contentBlocks?.length ? article.contentBlocks.map((block, i) => {
          if (block.type === 'heading') return <h2 key={i} className="text-xl font-semibold pt-5">{block.text}</h2>;
          if (block.type === 'quote') return <blockquote key={i} className="border-l-4 border-blue-500 pl-5 italic">{block.text}</blockquote>;
          if (block.type === 'caption') return <p key={i} className={`text-sm ${mutedText}`}>{block.text}</p>;
          if (block.type === 'list') { const Tag = block.ordered ? 'ol' : 'ul'; return <Tag key={i} className={`pl-6 space-y-2 ${block.ordered ? 'list-decimal' : 'list-disc'}`}>{block.items?.map((item, j) => <li key={j}>{item}</li>)}</Tag>; }
          return <p key={i}>{block.text}</p>;
        }) : (bodyContent || 'No content provided.').split(/\n\s*\n/).filter(Boolean).map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}
      </div>
    </>
  );
}
