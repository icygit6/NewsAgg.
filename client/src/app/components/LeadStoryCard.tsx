import { Link } from 'react-router';
import { Clock3 } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { useUiText } from '../i18n/uiText';
import { CATEGORY_BADGE_CLASS, CATEGORY_GROUP_HOVER_TEXT, TOPIC_TO_CATEGORY, categoryVars } from '../constants';
import { getArticleId } from '../services/newsAPI';
import { formatNewsDate } from '../lib/formatDate';
import type { NewsArticle } from '../types/article';
import { ImageWithFallback } from './utils/ImageWithFallback';
import { SourceLogo } from './ui/SourceLogo';

/** Preview (A1): the first story of the feed, given the width of the grid so the page has a
 * clear place to start instead of a wall of equal cards. */
export function LeadStoryCard({ article }: { article: NewsArticle }) {
  const ui = useUiText();
  const { isDark, language } = useApp();
  const articleId = getArticleId(article);
  const category = TOPIC_TO_CATEGORY[article.topic];
  const summary = article.aiSummary || article.description;

  return (
    <article data-testid="featured-story" className="group col-span-full min-w-0">
      <Link to={`/article/${articleId}`} viewTransition className="block h-full">
        <div
          style={categoryVars(category) as React.CSSProperties}
          className={`news-card-frame flex h-full flex-col overflow-hidden rounded-2xl border sm:grid sm:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800`}
        >
          <div className="relative aspect-[16/10] overflow-hidden sm:aspect-auto sm:min-h-[18rem] lg:min-h-[22rem]">
            <ImageWithFallback
              src={article.urlToImage || undefined}
              fallbackSources={article.images.map((image) => image.url)}
              alt={article.title}
              fetchPriority="high"
              decoding="async"
              style={{ viewTransitionName: `story-${articleId}` }}
              className="absolute inset-0 h-full w-full object-cover motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-out motion-safe:group-hover:scale-[1.03]"
            />
          </div>
          <div className="flex min-w-0 flex-1 flex-col p-4 lg:p-8">
            <span className={`self-start rounded-full px-2.5 py-1 text-xs font-semibold ${CATEGORY_BADGE_CLASS[category] ?? 'bg-slate-600 text-white'}`}>
              {ui(article.topic)}
            </span>
            <h2 className={`news-headline mt-2 line-clamp-3 break-words font-poppins text-xl font-bold leading-tight transition-colors lg:mt-4 md:text-2xl lg:line-clamp-4 lg:text-3xl ${CATEGORY_GROUP_HOVER_TEXT} text-[#0b1f33] dark:text-slate-50`}>
              {article.title}
            </h2>
            {summary && (
              <p className={`mt-3 line-clamp-2 text-sm leading-relaxed lg:line-clamp-3 lg:text-[15px] text-slate-600 dark:text-slate-300`}>{summary}</p>
            )}
            <div className="flex-1" />
            <div className={`mt-3 flex flex-wrap items-center gap-2 text-xs lg:mt-6 lg:gap-3 lg:text-sm text-slate-500 dark:text-slate-400`}>
              <SourceLogo source={article.source} isDark={isDark} className="h-7 w-7 lg:h-9 lg:w-9" />
              <span className={`min-w-0 truncate font-semibold text-slate-700 dark:text-slate-200`}>{article.source.name}</span>
              <span className="ml-auto inline-flex shrink-0 items-center gap-1.5"><Clock3 size={14} />{formatNewsDate(article.publishedAt, language)}</span>
            </div>
          </div>
        </div>
      </Link>
    </article>
  );
}
