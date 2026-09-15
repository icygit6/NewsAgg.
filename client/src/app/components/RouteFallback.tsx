import { FeedSkeleton } from './ui/ContentSkeleton';

/** Content-shaped fallback while lazy route modules load. */
export function RouteFallback() {
  return <div className="mx-auto max-w-6xl px-4 py-6"><FeedSkeleton /></div>;
}
