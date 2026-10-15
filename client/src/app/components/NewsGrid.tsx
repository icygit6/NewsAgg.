import { useUiText } from '../i18n/uiText';
import { useTitleTranslations } from '../hooks/useTitleTranslations';
import { useEffect, useRef } from 'react';
import { useApp } from '../contexts/AppContext';
import { useArticles, useRankedHeadlines } from '../hooks/useArticles';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { NewsCard } from './NewsCard';
import { HeroCarousel } from './HeroCarousel';
import { CATEGORY_LABELS } from '../constants';
import { FeedSkeleton, LoadingIndicator } from './ui/ContentSkeleton';

export function NewsGrid() {
  const ui = useUiText();
  const {
    t,
    isDark,
    selectedCategory,
    selectedSources,
    selectedSentiment,
    selectedSort,
    searchQuery,
  } = useApp();
  const debouncedQuery = useDebouncedValue(searchQuery.trim(), 250);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // All filtering happens server-side now (category/source/sentiment/q),
  // 20 summary rows per page instead of the legacy 400-article payload.
  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } = useArticles({
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
  const { data: heroData } = useRankedHeadlines({
    limit: 10,
    category: selectedCategory,
    sources: selectedSources,
    sentiment: selectedSentiment,
  });
  const heroIds = new Set(showHero ? (heroData?.articles ?? []).map((article) => article.id) : []);
  const gridArticles = articles.filter((article) => !heroIds.has(article.id));
  const displayArticles = useTitleTranslations(gridArticles);

  // Infinite scroll: pull the next page when the sentinel becomes visible.
  useEffect(() => {
    if (!hasNextPage) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { root: document.getElementById('main-scroll'), rootMargin: '200px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, articles.length]);

  if (isLoading) {
    return <FeedSkeleton label={t.loading} hero={!searchQuery.trim()} />;
  }

  if (isError) {
    return (
      <div
        className={`flex flex-col items-center justify-center py-20 text-center ${isDark ? 'text-red-400' : 'text-red-500'}`}
      >
        <div className="text-5xl mb-4">⚠️</div>
        <p className="text-lg font-medium">{t.errorTitle}</p>
        <p className="text-sm mt-1">{t.fetchFailed}</p>
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <div
        className={`flex flex-col items-center justify-center py-20 text-center ${isDark ? 'text-slate-400' : 'text-gray-400'}`}
      >
        <div className="text-5xl mb-4">📰</div>
        <p className="text-lg font-medium">{t.noResults}</p>
        <p className="text-sm mt-1">{t.tryDifferent}</p>
      </div>
    );
  }

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
      <div className="grid min-w-0 grid-cols-1 items-stretch gap-5 sm:grid-cols-2 @5xl:grid-cols-3">
        {displayArticles.map((article) => (
          <NewsCard key={article.id || article.url} article={article} />
        ))}
      </div>
      </div>

      {/* Infinite-scroll sentinel + loading indicator */}
      {hasNextPage && (
        <div ref={sentinelRef} className="min-h-16 flex items-center justify-center py-4 text-slate-500 dark:text-slate-400">
          {isFetchingNextPage ? <LoadingIndicator label={t.loading} /> : <button type="button" onClick={() => void fetchNextPage()} className="min-h-11 rounded-xl border border-slate-300 px-6 text-sm font-semibold hover:bg-blue-50 dark:border-slate-700 dark:hover:bg-slate-800">{ui('Load more')}</button>}
        </div>
      )}
    </div>
  );
}
