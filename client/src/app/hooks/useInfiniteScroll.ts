import { useEffect, useState } from 'react';

interface InfiniteScrollOptions {
  hasNextPage: boolean | undefined;
  isFetchingNextPage: boolean;
  /** The last page request failed. Stop auto-retrying so a dead endpoint is not hammered. */
  isError?: boolean;
  fetchNextPage: () => unknown;
  /** How far below the viewport the next page starts loading. */
  lookAhead?: number;
}

/** Loads the next page when the returned sentinel scrolls into view. Spread the result on the
 * element as its `ref`.
 *
 * It is a callback ref held in state, not a ref read inside an effect. The sentinel often mounts
 * later than the list (after a skeleton, or once a second query settles); an effect that read
 * `ref.current` once never saw it, no observer was attached, and only a "Load more" button
 * worked. Keeping the node in state re-runs the effect the moment it appears.
 *
 * The observer is rebuilt after every page, so if the sentinel is still on screen once a page
 * lands (a tall viewport, a short page) the next one is requested straight away. */
export function useInfiniteScroll({ hasNextPage, isFetchingNextPage, isError = false, fetchNextPage, lookAhead = 400 }: InfiniteScrollOptions) {
  const [sentinel, setSentinel] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!sentinel || !hasNextPage || isFetchingNextPage || isError) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries.some((entry) => entry.isIntersecting)) void fetchNextPage(); },
      // The app scrolls inside #main-scroll, not the window.
      { root: document.getElementById('main-scroll'), rootMargin: `0px 0px ${lookAhead}px 0px` },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sentinel, hasNextPage, isFetchingNextPage, isError, fetchNextPage, lookAhead]);

  return setSentinel;
}
