import { useUiText, useUiLocale } from '../../i18n/uiText';
import { Bookmark, Calendar, Clock3, Globe, Languages, MessageSquareQuote, PlayCircle, User } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useApp } from '../../contexts/AppContext';
import { useBookmarks } from '../../hooks/useBookmarks';
import { CATEGORY_BADGE_CLASS, CATEGORY_LABELS, POSTS_ENABLED, TOPIC_TO_CATEGORY } from '../../constants';
import { getArticleId } from '../../services/newsAPI';
import { ImageWithFallback } from '../utils/ImageWithFallback';
import type { NewsArticle } from '../../types/article';
import { SENTIMENT_STYLE, bodyTextClass, formatPublishedDate, formatLanguageName, mutedTextClass } from './helpers';
import { SourceLogo } from '../ui/SourceLogo';
import { SkeletonBlock } from '../ui/ContentSkeleton';
import { useState } from 'react';

interface ArticleHeaderProps {
  article: NewsArticle;
  isDark: boolean;
}

export function ArticleHeader({ article, isDark }: ArticleHeaderProps) {
  const ui = useUiText();
  const locale = useUiLocale();
  const { t, isAuthenticated, setSidebarOpen } = useApp();
  const { isBookmarked: isArticleBookmarked, bookmarkIdFor, add, remove } = useBookmarks();
  const navigate = useNavigate();
  const mutedText = mutedTextClass();
  const bodyText = bodyTextClass();
  const sentimentStyle = SENTIMENT_STYLE[article.sentiment.type];
  // Fallback guards legacy/unknown topics (e.g. pre-migration 'Travel').
  const topicBadgeClass = CATEGORY_BADGE_CLASS[TOPIC_TO_CATEGORY[article.topic]] ?? 'bg-slate-600 text-white';

  const articleId = getArticleId(article);
  const imageKey = article.urlToImage || article.images[0]?.url || articleId;
  const [loadedImage, setLoadedImage] = useState('');
  const imagePending = Boolean(article.urlToImage || article.images.length) && loadedImage !== imageKey;
  const isBookmarked = isArticleBookmarked(articleId);
  const isBookmarking = add.isPending || remove.isPending;

  const handleBookmark = () => {
    if (!isAuthenticated) {
      setSidebarOpen(true); // sign-in gate, same as NewsCard
      return;
    }
    if (isBookmarked) {
      const bookmarkId = bookmarkIdFor(articleId);
      if (bookmarkId) remove.mutate(bookmarkId);
    } else {
      add.mutate(article);
    }
  };

  return (
    <>
      <div className="grid items-center gap-5 mb-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div data-testid="article-cover" className="relative w-full rounded-2xl overflow-hidden">
        {imagePending && <SkeletonBlock className="absolute inset-0 h-full w-full rounded-none" />}
        <ImageWithFallback src={article.urlToImage || article.images[0]?.url || undefined} fallbackSources={article.images.map((image) => image.url)} alt={article.title} fetchPriority="high" decoding="async" onLoad={() => setLoadedImage(imageKey)} onError={() => setLoadedImage(imageKey)} style={{ viewTransitionName: `story-${getArticleId(article)}` }} className={`block h-auto w-full motion-safe:transition-opacity motion-safe:duration-200 ${imagePending ? 'min-h-48 opacity-0' : 'opacity-100'}`} />
        <div className="absolute top-3 left-3 flex flex-wrap items-center gap-2">
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${topicBadgeClass}`}>{ui(article.topic)}</span>
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${sentimentStyle.badge}`}>{t[article.sentiment.type]}</span>
          {article.videoUrl && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-black/35 text-white backdrop-blur-sm">
              <PlayCircle size={14} />{ui("Video")} </span>
          )}
        </div>
      </div>

      <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <SourceLogo source={article.source} isDark={isDark} className="w-10 h-10" />
        <div className="min-w-0">
          <p className={`text-sm font-semibold text-slate-900 dark:text-slate-100`}>{article.source.name}</p>
          <p className={`text-xs ${mutedText}`}>{ui(CATEGORY_LABELS[TOPIC_TO_CATEGORY[article.topic]] ?? article.topic)} {ui("coverage")}</p>
        </div>
      </div>

      <h1 className={`article-title font-poppins text-[2rem] font-bold leading-tight mb-4 text-slate-900 dark:text-slate-50`}>
        {article.title}
      </h1>
      </div>
      </div>

      <div className={`flex flex-wrap items-center gap-4 pb-4 mb-6 border-b text-sm border-slate-100 dark:border-slate-700`}>
        <div className="flex items-center gap-1.5"><User size={14} className={mutedText} /><span className={bodyText}>{article.author || ui("Unknown")}</span></div>
        <div className="flex items-center gap-1.5"><Calendar size={14} className={mutedText} /><span className={bodyText}>{formatPublishedDate(article.publishedAt, locale)}</span></div>
        <div className="flex items-center gap-1.5"><Globe size={14} className={mutedText} /><span className={bodyText}>{article.source.name}</span></div>
        <div className="flex items-center gap-1.5"><Clock3 size={14} className={mutedText} /><span className={bodyText}>{ui(article.readability.readingTimeMin > 0 ? `${article.readability.readingTimeMin} min read` : 'Quick read')}</span></div>
        {article.language && <div className="flex items-center gap-1.5"><Languages size={14} className={mutedText} /><span className={bodyText}>{formatLanguageName(article.language, locale)}</span></div>}
        <button
          type="button"
          onClick={handleBookmark}
          disabled={isBookmarking}
          aria-pressed={isBookmarked}
          className={`ml-auto inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors disabled:opacity-50 ${
            isBookmarked
              ? 'bg-amber-500 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:border dark:border-slate-700'
          }`}
        >
          <Bookmark size={14} fill={isBookmarked ? 'currentColor' : 'none'} />
          {isBookmarked ? t.bookmarked : t.bookmark}
        </button>
        {POSTS_ENABLED && (
          <button
            type="button"
            onClick={() => navigate(`/posts?compose=1&attach=${articleId}`)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:border dark:border-slate-700`}
          >
            <MessageSquareQuote size={14} />
            {t.quoteThis}
          </button>
        )}
      </div>
    </>
  );
}
