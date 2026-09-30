import { useUiText } from '../i18n/uiText';
import { Link, useNavigate } from 'react-router';
import { Clock3, MessageSquareQuote, PlayCircle, ShieldAlert, Sparkles, Bookmark } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { useBookmarks } from '../hooks/useBookmarks';
import { CATEGORY_BADGE_CLASS, POSTS_ENABLED, TOPIC_TO_CATEGORY } from '../constants';
import { getArticleId } from '../services/newsAPI';
import type { NewsArticle } from '../types/article';
import type { SentimentType } from '../types/sentiment';
import { ImageWithFallback } from './utils/ImageWithFallback';

const SENTIMENT_STYLE: Record<SentimentType, { bg: string; dot: string; dark: string }> = {
  positive: { bg: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', dark: 'bg-emerald-900/40 text-emerald-300' },
  neutral: { bg: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400', dark: 'bg-gray-700 text-gray-300' },
  negative: { bg: 'bg-red-100 text-red-700', dot: 'bg-red-500', dark: 'bg-red-900/40 text-red-300' },
};

const formatDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString();
};

interface NewsCardProps {
  article: NewsArticle;
}

export function NewsCard({ article }: NewsCardProps) {
  const ui = useUiText();
  const { t, isDark, isAuthenticated, setSidebarOpen } = useApp();
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
      <Link to={`/article/${articleId}`} className="block h-full">
        <div className={`flex h-full min-h-[500px] flex-col overflow-hidden rounded-2xl border transition-[border-color,box-shadow] duration-200 ${isDark ? 'bg-slate-900/90 border-slate-800 hover:border-slate-600' : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-md'}`}>
          <div className="relative h-52 flex-shrink-0 overflow-hidden sm:h-56 lg:h-60">
            <ImageWithFallback
              src={article.urlToImage || secondaryImage || undefined}
              alt={article.title}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />

            <div className="absolute top-3 left-3 right-3 flex items-start justify-between gap-2">
              <div className={`text-xs px-2.5 py-1 rounded-full font-semibold uppercase tracking-wide ${categoryClass}`}>
                {ui(article.topic)}
              </div>

              <div className="flex flex-wrap items-center justify-end gap-1.5">
                <button
                  onClick={handleBookmarkClick}
                  disabled={isBookmarking}
                  aria-label={isBookmarked ? t.bookmarked : t.bookmark}
                  aria-pressed={isBookmarked}
                  title={isBookmarked ? t.bookmarked : t.bookmark}
                  className={`inline-flex items-center justify-center p-2 rounded-full transition-all backdrop-blur-sm disabled:opacity-50 ${
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
                    className="inline-flex items-center justify-center p-2 rounded-full transition-all backdrop-blur-sm bg-black/40 text-white hover:bg-black/60"
                  >
                    <MessageSquareQuote size={16} />
                  </button>
                )}

                {article.videoUrl && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
                    <PlayCircle size={12} />{ui("Video")} </span>
                )}
                {article.isPremium && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/90 px-2 py-1 text-[11px] font-medium text-white">
                    <ShieldAlert size={12} />{ui("Premium")} </span>
                )}
              </div>
            </div>

            <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center gap-2">
              <span className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${isDark ? sentStyle.dark : sentStyle.bg}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${sentStyle.dot}`} />
                {t[article.sentiment.type]}
              </span>

              {article.section && (
                <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
                  {article.section}
                </span>
              )}
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col p-5">
            <div className="mb-4 flex min-w-0 items-center gap-3">
              {article.source.logo ? (
                <img
                  src={article.source.logo}
                  alt={article.source.name}
                  loading="lazy"
                  decoding="async"
                  className={`h-9 w-9 rounded-full object-cover flex-shrink-0 ${isDark ? 'bg-slate-900/80' : 'bg-white'}`}
                />
              ) : (
                <div className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${isDark ? 'bg-slate-700 text-slate-200' : 'bg-gray-100 text-gray-600'}`}>
                  {article.source.name.slice(0, 1)}
                </div>
              )}

              <div className="min-w-0">
                <p className={`truncate text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>
                  {article.source.name}
                </p>
                <p className={`text-[11px] truncate ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                  {article.author || ui("Unknown")}
                </p>
              </div>
            </div>

            <h3 className={`mb-3 line-clamp-3 font-poppins text-xl font-semibold leading-snug transition-colors group-hover:text-blue-600 ${isDark ? 'text-slate-100' : 'text-[#0b1f33]'}`}>
              {article.title}
            </h3>

            <div className="flex-1" />

            <div className="mb-4 flex flex-wrap items-center gap-2">
              {article.aiTopLabel && (
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${isDark ? 'bg-cyan-500/15 text-cyan-300' : 'bg-cyan-50 text-cyan-700'}`}>
                  <Sparkles size={12} />
                  {ui(article.aiTopLabel)}
                </span>
              )}

              {article.keywords.slice(0, 3).map((keyword) => (
                <span
                  key={`${article.id}-${keyword}`}
                  className={`inline-block max-w-[120px] truncate rounded-full px-2.5 py-1 text-[11px] ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-gray-100 text-gray-600'}`}
                >
                  #{keyword}
                </span>
              ))}
            </div>

            <div className={`flex items-center justify-between gap-3 pt-3 border-t text-xs ${isDark ? 'border-slate-700 text-slate-400' : 'border-gray-200 text-gray-500'}`}>
              <div className="flex items-center gap-1.5 min-w-0">
                <Clock3 size={13} className="flex-shrink-0 opacity-70" />
                <span className="truncate font-medium">
                  {ui(article.readability.readingTimeMin > 0 ? `${article.readability.readingTimeMin} min` : 'Quick read')}
                </span>
              </div>

              <span className="flex-shrink-0 font-medium">{formatDate(article.publishedAt)}</span>
            </div>

            <div className={`flex items-center justify-between gap-3 mt-2.5 text-[11px] ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
              <span className="truncate opacity-80">{article.source.domain || t.source}</span>
            </div>
          </div>
        </div>
      </Link>
    </article>
  );
}
