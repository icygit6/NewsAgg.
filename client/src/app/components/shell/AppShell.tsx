import { useEffect, type ReactNode } from 'react';
import { useApp } from '../../contexts/AppContext';
import { useMatches, useLocation } from 'react-router';
import { NavRail } from './NavRail';
import { RightRail } from './RightRail';
import { BottomTabBar } from './BottomTabBar';
import { TopBar } from './TopBar';
import { FeedHeader } from './FeedHeader';
import { Footer } from './Footer';
import { usePublicationRefresh } from '../../hooks/usePublicationRefresh';
import { useScrollFade, fadeMask } from '../../hooks/useScrollFade';
import { DEFAULT_TITLE } from '../SeoMetadata';

interface RouteHandle {
  hideRightRail?: boolean;
  hideFooter?: boolean;
  mobileFooter?: boolean;
  /** Browser-tab title as [English, Traditional Chinese]; Home keeps the full project name. */
  title?: readonly [string, string];
}

export function AppShell({ children }: { children: ReactNode }) {
  usePublicationRefresh();
  const matches = useMatches();
  const { pathname } = useLocation();
  const { selectedCategory, language } = useApp();
  const isArticle = pathname.startsWith('/article/');
  const pageTitle = matches.reduce<RouteHandle['title']>((acc, m) => (m.handle as RouteHandle | undefined)?.title ?? acc, undefined);
  useEffect(() => {
    // Article pages take their title from the story (SeoMetadata).
    if (isArticle) return;
    document.title = pageTitle ? `${pageTitle[language === 'zhTW' ? 1 : 0]} · NewsAgg` : DEFAULT_TITLE;
  }, [isArticle, pageTitle, language]);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const animation = scrollFade.ref.current?.animate?.([{ opacity: 0.7 }, { opacity: 1 }], { duration: 180, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
    return () => animation?.cancel();
  }, [pathname, selectedCategory]);
  const scrollFade = useScrollFade<HTMLElement>(pathname);
  const isHome = pathname === '/';
  const handle = matches.reduce<RouteHandle>((acc, m) => {
    const h = (m.handle ?? {}) as RouteHandle;
    return {
      hideRightRail: acc.hideRightRail || h.hideRightRail,
      hideFooter: acc.hideFooter || h.hideFooter,
      mobileFooter: acc.mobileFooter || h.mobileFooter,
    };
  }, {});

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <div className="flex flex-1 min-h-0">
        <NavRail />

        <div className={`flex flex-1 min-h-0 min-w-0 ${handle.hideRightRail ? '' : 'lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:grid-rows-[minmax(0,1fr)]'}`}>
          {/* Centre column: header sits above main only */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {isHome ? <FeedHeader /> : <TopBar />}
            <main
              id="main-scroll"
              ref={scrollFade.ref}
              className={`main-scroll-performance flex-1 min-h-0 min-w-0 overflow-x-hidden overflow-y-auto pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0 ${isArticle ? 'lg:overflow-y-hidden' : ''}`}
              style={{ scrollbarWidth: 'none', ...fadeMask(scrollFade.above, scrollFade.below, 20) }}
            >
              {children}
              {!handle.hideFooter && !isArticle && <Footer hiddenOnMobile={!handle.mobileFooter} />}
            </main>
          </div>

          {!handle.hideRightRail && <RightRail />}
        </div>
      </div>

      <BottomTabBar />
    </div>
  );
}
