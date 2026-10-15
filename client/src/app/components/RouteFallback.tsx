import { useInRouterContext, useLocation } from 'react-router';
import { ArticleSkeleton, FeedSkeleton, ListSkeleton, PanelSkeleton } from './ui/ContentSkeleton';

/** Content-shaped fallback while lazy route modules load. */
export function RouteFallback() {
  const inRouter = useInRouterContext();
  return inRouter ? <RoutedFallback /> : <FallbackForPath pathname={typeof window === 'undefined' ? '/' : window.location.pathname} />;
}

function RoutedFallback() {
  const { pathname } = useLocation();
  return <FallbackForPath pathname={pathname} />;
}

function FallbackForPath({ pathname }: { pathname: string }) {
  if (pathname.startsWith('/article/')) return <ArticleSkeleton />;
  return <div className="mx-auto max-w-6xl px-4 py-6">{pathname === '/insights' ? <PanelSkeleton /> : pathname === '/' || pathname.startsWith('/country/') ? <FeedSkeleton hero /> : <ListSkeleton />}</div>;
}
