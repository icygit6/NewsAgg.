import type { ReactNode } from 'react';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';
import { useUiText } from '../../i18n/uiText';
import { LoadingIndicator } from './ContentSkeleton';
import { LoadError } from './ErrorNote';

interface InfiniteScrollFooterProps {
  hasNextPage: boolean | undefined;
  isFetchingNextPage: boolean;
  isError?: boolean;
  fetchNextPage: () => unknown;
  /** Shown while a page loads. Defaults to the compact spinner every list shares. */
  loading?: ReactNode;
  label?: string;
  /** Tighter spacing, for a list nested inside a card (comments). */
  compact?: boolean;
}

/** The end of every long list. There is no "Load more" button: the next page is requested as the
 * reader scrolls. The only control it can show is Retry, and only after a page failed to load. */
export function InfiniteScrollFooter({ hasNextPage, isFetchingNextPage, isError = false, fetchNextPage, loading, label, compact = false }: InfiniteScrollFooterProps) {
  const ui = useUiText();
  const sentinel = useInfiniteScroll({ hasNextPage, isFetchingNextPage, isError, fetchNextPage });
  if (!hasNextPage) return null;
  return (
    <div ref={sentinel} data-testid="infinite-scroll-sentinel" className={`flex items-center justify-center text-slate-500 dark:text-slate-400 ${compact ? 'min-h-10 py-2 text-xs' : 'min-h-16 py-4'}`}>
      {isFetchingNextPage ? (loading ?? <LoadingIndicator label={label} />) : isError && (
        <LoadError message={ui('Could not load more.')} onRetry={() => void fetchNextPage()} />
      )}
    </div>
  );
}
