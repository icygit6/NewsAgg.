import { useEffect, useRef } from 'react';
import { useApp } from '../contexts/AppContext';
import { useArticles } from '../hooks/useArticles';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { usePreviewTranslations } from '../hooks/usePreviewTranslations';
import { NewsCard } from './NewsCard';
import { HeroCarousel } from './HeroCarousel';
import { CATEGORY_LABELS } from '../constants';
import { FeedSkeleton } from './ui/ContentSkeleton';

export function NewsGrid() {
  const { t, isDark, selectedCategory, selectedSources, selectedSentiment, searchQuery } = useApp();
  const debouncedQuery = useDebouncedValue(searchQuery.trim(), 250);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // All filtering happens server-side now (category/source/sentiment/q),
  // 20 summary rows per page instead of the legacy 400-article payload.
  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useArticles({
    category: selectedCategory,
    sources: selectedSources,
    sentiment: selectedSentiment,
    q: debouncedQuery,
    // The unfiltered front page is an editorially ranked, source-diverse feed.
    // Search and category pages remain chronological.
    sort: selectedCategory === 'all' && !debouncedQuery ? 'top' : 'latest',
    pageSize: 20,
  });

  const articles = data?.pages.flatMap((page) => page.articles) ?? [];
  const { data: previewTranslations = {} } = usePreviewTranslations(articles);
  const displayArticles = articles.map((article) => {
    const translated = previewTranslations[article.id];
    return translated && translated.provider !== 'none'
      ? { ...article, title: translated.title ?? article.title, description: translated.description ?? article.description, aiSummary: translated.aiSummary ?? article.aiSummary }
      : article;
  });

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
      { rootMargin: '200px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, articles.length]);

  if (isLoading) {
    return (
      <FeedSkeleton label={t.loading} hero={!searchQuery.trim()} />
    );
  }

  if (isError) {
    return (
      <div className={`flex flex-col items-center justify-center py-20 text-center ${isDark ? 'text-red-400' : 'text-red-500'}`}>
        <div className="text-5xl mb-4">⚠️</div>
        <p className="text-lg font-medium">{t.errorTitle}</p>
        <p className="text-sm mt-1">{t.fetchFailed}</p>
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center py-20 text-center ${isDark ? 'text-slate-400' : 'text-gray-400'}`}>
        <div className="text-5xl mb-4">📰</div>
        <p className="text-lg font-medium">{t.noResults}</p>
        <p className="text-sm mt-1">{t.tryDifferent}</p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-hidden">
      {selectedCategory !== 'all' && (
        <header className="flex items-end justify-between gap-4 py-5">
          <h1 className="text-3xl font-extrabold tracking-tight">{CATEGORY_LABELS[selectedCategory]}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{(data?.pages[0]?.totalCount ?? articles.length).toLocaleString()} articles</p>
        </header>
      )}

      {/* Hero Carousel — hidden while searching (raw query so it reacts on the
          first keystroke). Its data follows the active category filter. */}
      {searchQuery.trim().length === 0 && (
        <div className="mb-8 overflow-hidden">
          <HeroCarousel />
        </div>
      )}

      {/* Feed: single column in the X-style centre; two columns once the
          full-bleed centre grows past ~900px (viewport ≥1600px). */}
      <div className="grid grid-cols-1 sm:grid-cols-2 items-stretch gap-3 sm:gap-5 overflow-x-hidden">
        {displayArticles.map((article, i) => (
          <NewsCard key={article.id || article.url} article={article} index={i} />
        ))}
      </div>

      {/* Infinite-scroll sentinel + loading indicator */}
      {hasNextPage && (
        <div ref={sentinelRef} className="min-h-4">
          {isFetchingNextPage && <FeedSkeleton count={2} label={t.loading} />}
        </div>
      )}
    </div>
  );
}
