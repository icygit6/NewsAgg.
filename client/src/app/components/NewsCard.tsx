import { useUiText } from '../i18n/uiText';
import { Link, useNavigate } from 'react-router';
import { Clock3, MessageSquareQuote, PlayCircle, ShieldAlert, Bookmark } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { useBookmarks } from '../hooks/useBookmarks';
import { CATEGORY_BADGE_CLASS, CATEGORY_GROUP_HOVER_TEXT, POSTS_ENABLED, TOPIC_TO_CATEGORY, categoryVars } from '../constants';
import { getArticleId } from '../services/newsAPI';
import type { NewsArticle } from '../types/article';
import type { SentimentType } from '../types/sentiment';
import { ImageWithFallback } from './utils/ImageWithFallback';
import { SourceLogo } from './ui/SourceLogo';
import { formatNewsDate } from '../lib/formatDate';

const SENTIMENT_STYLE: Record<SentimentType, { bg: string; dot: string; dark: string }> = {
  positive: { bg: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', dark: 'bg-emerald-900/40 text-emerald-300' },
  neutral: { bg: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500', dark: 'bg-amber-500/20 text-amber-200' },
  negative: { bg: 'bg-red-100 text-red-700', dot: 'bg-red-500', dark: 'bg-red-900/40 text-red-300' },
};

interface NewsCardProps {
  article: NewsArticle;
}

export function NewsCard({ article }: NewsCardProps) {
  const ui = useUiText();
  const { t, isDark, isAuthenticated, setSidebarOpen, language } = useApp();
  const { isBookmarked: isArticleBookmarked, bookmarkIdFor, add, remove } = useBookmarks();
  const navigate = useNavigate();
  const articleId = getArticleId(article);

  const handleQuoteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/posts?compose=1&attach=${articleId}`);
  };
  const isBookmarked = isArticleBookmarked(articleId);
  const isBookmarking = add.isPending || remove.isPending;
  const sentiment = article.sentiment.type;
  const sentStyle = SENTIMENT_STYLE[sentiment];
  // Fallback guards legacy/unknown topics (e.g. pre-migration 'Travel') so an
  // unmapped topic renders a neutral badge instead of an `undefined` class.
  const categoryClass = CATEGORY_BADGE_CLASS[TOPIC_TO_CATEGORY[article.topic]] ?? 'bg-slate-600 text-white';
  const secondaryImage = article.images.find((image) => !image.isPrimary)?.url;

  const handleBookmarkClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) {
      setSidebarOpen(true);
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
    <article className="content-auto-card group min-w-0 motion-safe:transition-transform motion-safe:duration-200 motion-safe:hover:-translate-y-0.5">
      <Link to={`/article/${articleId}`} viewTransition className="block h-full">
        <div style={categoryVars(TOPIC_TO_CATEGORY[article.topic]) as React.CSSProperties} className={`news-card-frame flex h-full flex-col overflow-hidden rounded-2xl border transition-[border-color,box-shadow] duration-200 ${isDark ? 'bg-slate-900 border-slate-800 hover:border-slate-600' : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-md'}`}>
          <div className="relative aspect-[16/10] flex-shrink-0 overflow-hidden">
            <ImageWithFallback
              src={article.urlToImage || secondaryImage || undefined}
              fallbackSources={article.images.map((image) => image.url)}
              alt={article.title}
              style={{ viewTransitionName: `story-${articleId}` }}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ease-out"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />

            <div className="absolute top-2 left-2 right-2 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-1 sm:top-3 sm:left-3 sm:right-3 sm:flex sm:justify-between sm:gap-2">
              <div title={ui(article.topic)} className={`min-w-0 max-w-full w-fit truncate text-[11px] px-1.5 py-1 rounded-full font-semibold sm:px-2.5 sm:text-xs ${categoryClass}`}>
                {ui(article.topic)}
              </div>

              <div className="flex max-w-16 flex-wrap items-center justify-end gap-1 sm:max-w-none sm:gap-1.5">
                <button
                  onClick={handleBookmarkClick}
                  disabled={isBookmarking}
                  aria-label={isBookmarked ? t.bookmarked : t.bookmark}
                  aria-pressed={isBookmarked}
                  title={isBookmarked ? t.bookmarked : t.bookmark}
                  className={`toggle-pop inline-flex items-center justify-center p-1.5 sm:p-2 rounded-full transition-all backdrop-blur-sm disabled:opacity-50 ${
                    isBookmarked
                      ? 'bg-amber-500/90 text-white'
                      : 'bg-black/40 text-white hover:bg-black/60'
                  }`}
                >
                  <Bookmark size={16} fill={isBookmarked ? 'currentColor' : 'none'} />
                </button>

                {POSTS_ENABLED && (
                  <button
                    onClick={handleQuoteClick}
                    aria-label={t.quoteThis}
                    title={t.quoteThis}
                    className="inline-flex items-center justify-center p-1.5 sm:p-2 rounded-full transition-all backdrop-blur-sm bg-black/40 text-white hover:bg-black/60"
                  >
                    <MessageSquareQuote size={16} />
                  </button>
                )}

                {article.videoUrl && (
                  <span title={ui('Video')} className="inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
                    <PlayCircle size={14} /><span className="hidden sm:inline">{ui("Video")}</span></span>
                )}
                {article.isPremium && (
                  <span title={ui('Premium')} className="inline-flex items-center gap-1 rounded-full bg-amber-500/90 px-2 py-1 text-[11px] font-medium text-white">
                    <ShieldAlert size={14} /><span className="hidden sm:inline">{ui("Premium")}</span></span>
                )}
              </div>
            </div>

            <div className="absolute bottom-2 left-2 right-2 flex flex-wrap items-center gap-1 sm:bottom-3 sm:left-3 sm:right-3 sm:gap-2">
              <span className={`flex items-center gap-1 px-1.5 py-1 rounded-full text-[11px] font-semibold sm:gap-1.5 sm:px-2.5 sm:text-xs ${isDark ? sentStyle.dark : sentStyle.bg}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${sentStyle.dot}`} />
                {t[article.sentiment.type]}
              </span>


            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col p-2.5 sm:p-3">
            <div className="mb-2 flex min-w-0 items-center gap-2">
              <SourceLogo source={article.source} isDark={isDark} className="h-7 w-7 shrink-0 sm:h-8 sm:w-8" />

              <div className="min-w-0">
                <p className={`truncate text-xs font-semibold sm:text-sm text-slate-700 dark:text-slate-200`}>
                  {article.source.name}
                </p>
                <p className={`hidden text-xs truncate sm:block text-slate-500 dark:text-slate-400`}>
                  {article.author || ui("Unknown")}
                </p>
              </div>
            </div>

            <h3 title={article.title} className={`news-headline mb-2 shrink-0 line-clamp-3 min-h-[4.2em] [overflow-wrap:anywhere] font-poppins text-sm font-semibold leading-[1.4] transition-colors sm:text-base ${CATEGORY_GROUP_HOVER_TEXT} text-[#0b1f33] dark:text-slate-100`} style={{ textWrap: 'wrap' }}>
              {article.title}
            </h3>

            {/* At least the height of the bookmark card's action row, so home and bookmark
                cards are the same height (headlines above reserve three lines, as there). */}
            <div className="min-h-11 flex-1" />

            <div className="mb-2 flex min-w-0 items-center gap-1 overflow-hidden">
              {article.keywords.slice(0, 3).map((keyword) => (
                <span
                  key={`${article.id}-${keyword}`}
                  title={`#${keyword}`}
                  className={`inline-block min-w-0 max-w-[120px] truncate rounded-full px-2 py-1 text-[11px] bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300`}
                >
                  #{keyword}
                </span>
              ))}
            </div>

            <div className={`flex flex-wrap items-center justify-between gap-x-2 gap-y-1 pt-2 border-t text-xs border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400`}>
              <div className="flex items-center gap-1.5 min-w-0">
                <Clock3 size={14} className="flex-shrink-0 opacity-70" />
                <span className="truncate font-medium">
                  {ui(article.readability.readingTimeMin > 0 ? `${article.readability.readingTimeMin} min` : 'Quick read')}
                </span>
              </div>

              <span className="flex-shrink-0 font-medium">{formatNewsDate(article.publishedAt, language)}</span>
            </div>

            <div className={`flex min-w-0 items-center justify-between gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400`}>
              <span className="truncate opacity-80">{article.source.domain || t.source}</span>
            </div>
          </div>
        </div>
      </Link>
    </article>
  );
}
