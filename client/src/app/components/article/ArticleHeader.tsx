import { useUiText, useUiLocale } from '../../i18n/uiText';
import { Calendar, Clock3, Languages, PlayCircle, User } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { CATEGORY_BADGE_CLASS, CATEGORY_LABELS, TOPIC_TO_CATEGORY } from '../../constants';
import { getArticleId } from '../../services/newsAPI';
import { ImageWithFallback } from '../utils/ImageWithFallback';
import type { NewsArticle } from '../../types/article';
import { SENTIMENT_STYLE, bodyTextClass, formatPublishedDate, formatLanguageName, mutedTextClass } from './helpers';
import { SourceLogo } from '../ui/SourceLogo';
import { SkeletonBlock } from '../ui/ContentSkeleton';
import { ArticleActions } from './ArticleActions';
import { Fragment, useState } from 'react';

interface ArticleHeaderProps {
  article: NewsArticle;
  isDark: boolean;
}

export function ArticleHeader({ article, isDark }: ArticleHeaderProps) {
  const ui = useUiText();
  const locale = useUiLocale();
  const { t } = useApp();
  const mutedText = mutedTextClass();
  const bodyText = bodyTextClass();
  const sentimentStyle = SENTIMENT_STYLE[article.sentiment.type];
  // Fallback guards legacy/unknown topics (e.g. pre-migration 'Travel').
  const topicBadgeClass = CATEGORY_BADGE_CLASS[TOPIC_TO_CATEGORY[article.topic]] ?? 'bg-slate-600 text-white';

  // Skip the author when it only repeats the publisher shown above.
  const author = article.author?.trim();
  const sameAsSource = !!author && author.toLowerCase() === article.source.name.trim().toLowerCase();
  const details = [
    ...(sameAsSource ? [] : [{ key: 'author', Icon: User, text: author || ui("Unknown") }]),
    { key: 'date', Icon: Calendar, text: formatPublishedDate(article.publishedAt, locale), short: formatPublishedDate(article.publishedAt, locale, 'medium') },
    { key: 'read', Icon: Clock3, text: ui(article.readability.readingTimeMin > 0 ? `${article.readability.readingTimeMin} min read` : 'Quick read') },
    ...(article.language ? [{ key: 'lang', Icon: Languages, text: formatLanguageName(article.language, locale) }] : []),
  ];

  const articleId = getArticleId(article);
  const imageKey = article.urlToImage || article.images[0]?.url || articleId;
  const [loadedImage, setLoadedImage] = useState('');
  const imagePending = Boolean(article.urlToImage || article.images.length) && loadedImage !== imageKey;


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

      <h1 className={`article-title font-poppins text-[1.625rem] sm:text-[2rem] font-bold leading-tight xl:mb-4 text-slate-900 dark:text-slate-50`}>
        {article.title}
      </h1>
      </div>
      </div>

      {/* Phones: one quiet line of dot-separated text (icons and the full weekday return from sm up). */}
      <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 pb-4 mb-4 border-b text-[13px] sm:gap-x-4 sm:gap-y-1.5 sm:text-sm border-slate-100 dark:border-slate-700`}>
        {details.map((item, index) => (
          <Fragment key={item.key}>
            {index > 0 && <span aria-hidden="true" className={`sm:hidden ${mutedText}`}>·</span>}
            <div className="flex items-center gap-1.5"><item.Icon size={14} className={`max-sm:hidden ${mutedText}`} />{'short' in item
              ? <span className={bodyText}><span className="sm:hidden">{item.short}</span><span className="max-sm:hidden">{item.text}</span></span>
              : <span className={bodyText}>{item.text}</span>}</div>
          </Fragment>
        ))}
      </div>
      <ArticleActions article={article} isDark={isDark} />
    </>
  );
}
