import { useUiText } from '../i18n/uiText';
import { useTitleTranslations } from '../hooks/useTitleTranslations';
import { useApp } from '../contexts/AppContext';
import { useArticles, useRankedHeadlines } from '../hooks/useArticles';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { NewsCard } from './NewsCard';
import { HeroCarousel } from './HeroCarousel';
import { CATEGORY_LABELS } from '../constants';
import { FeedSkeleton } from './ui/ContentSkeleton';
import { InfiniteScrollFooter } from './ui/InfiniteScrollFooter';
import { LeadStoryCard } from './LeadStoryCard';
import { MoreInCategory } from './feed/MoreInCategory';
import { FeedState, feedStateButton } from './feed/FeedState';
import { withCategoryRunsByPage } from './feed/categoryRuns';

export function NewsGrid() {
  const ui = useUiText();
  const {
    t,
    selectedCategory,
    selectedSources,
    selectedSentiment,
    selectedSort,
    searchQuery,
    setSelectedCategory,
    setSelectedSources,
    setSelectedSentiment,
    setSearchQuery,
  } = useApp();
  const debouncedQuery = useDebouncedValue(searchQuery.trim(), 250);

  // All filtering happens server-side now (category/source/sentiment/q),
  // 20 summary rows per page instead of the legacy 400-article payload.
  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage, isFetchNextPageError } = useArticles({
    category: selectedCategory,
    sources: selectedSources,
    sentiment: selectedSentiment,
    q: debouncedQuery,
    sort: selectedSort,
    pageSize: 20,
  });

  // Offset pages may overlap when a new publication arrives during browsing.
  const articles = [...new Map((data?.pages.flatMap((page) => page.articles) ?? [])
    .map(article => [article.id || article.url, article])).values()];
  // The carousel above already shows its ten ranked headlines; repeating them
  // as the first cards made the top of the feed look duplicated. Shares the
  // carousel's query cache, so this adds no request.
  const showHero = searchQuery.trim().length === 0;
  const { data: heroData, isPending: heroPending } = useRankedHeadlines({
    limit: 10,
    category: selectedCategory,
    sources: selectedSources,
    sentiment: selectedSentiment,
  });
  const heroIds = new Set(showHero ? (heroData?.articles ?? []).map((article) => article.id) : []);
  const gridArticles = articles.filter((article) => !heroIds.has(article.id));
  const displayArticles = useTitleTranslations(gridArticles);

  // Hold the grid until the carousel's headlines are known: filtering them
  // out after the cards had rendered pushed every card upwards (CLS 0.48).
  if (isLoading || (showHero && heroPending)) {
    return <FeedSkeleton label={t.loading} hero={!searchQuery.trim()} />;
  }

  if (isError) {
    return <FeedState tone="error" title={t.errorTitle} body={t.fetchFailed} action={<button type="button" onClick={() => void refetch()} className={feedStateButton}>{ui('Try again')}</button>} />;
  }
  if (articles.length === 0) {
    return <FeedState title={t.noResults} body={t.tryDifferent} action={<button type="button" onClick={() => { setSelectedCategory('all'); setSelectedSources([]); setSelectedSentiment('all'); setSearchQuery(''); }} className={feedStateButton}>{ui('Clear filters')}</button>} />;
  }


  // Preserve server page boundaries when inserting category headline groups.
  const lead = !debouncedQuery ? displayArticles[0] : undefined;
  const rest = lead ? displayArticles.slice(1) : displayArticles;
  const pageOf = new Map<string, number>();
  data?.pages.forEach((page, index) => page.articles.forEach((article) => { if (!pageOf.has(article.id)) pageOf.set(article.id, index); }));

  return (
    <div className="w-full min-w-0">
      {selectedCategory !== 'all' && (
        <header className="flex items-end justify-between gap-4 py-5">
          <h1 className="text-3xl font-extrabold tracking-tight">
            {ui(CATEGORY_LABELS[selectedCategory])}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {(data?.pages[0]?.totalCount ?? articles.length).toLocaleString()} {ui("articles")} </p>
        </header>
      )}

      {/* Hero Carousel — hidden while searching (raw query so it reacts on the
          first keystroke). Its data follows the active category filter. */}
      {showHero && (
        <div className="mb-8 overflow-hidden">
          <HeroCarousel />
        </div>
      )}

      {/* Vertical cards stay roomy while using the wider feed efficiently. */}
      <div className="@container min-w-0">
      {/* Desktop keeps three news cards per row; smaller screens reflow. */}
      <div className="grid min-w-0 grid-cols-2 items-stretch gap-3 lg:grid-cols-3 lg:gap-4">
        {lead && <LeadStoryCard article={lead} />}
        {withCategoryRunsByPage(rest, pageOf).map((item) =>
          item.kind === 'card'
            ? <NewsCard key={item.article.id || item.article.url} article={item.article} />
            : <MoreInCategory key={`more-${item.articles[0].id}`} articles={item.articles} />)}
      </div>
      </div>

      {/* The next page loads as the reader scrolls; there is deliberately no button. */}
      <InfiniteScrollFooter hasNextPage={hasNextPage} isFetchingNextPage={isFetchingNextPage} isError={isFetchNextPageError} fetchNextPage={fetchNextPage} label={t.loading} />
    </div>
  );
}
