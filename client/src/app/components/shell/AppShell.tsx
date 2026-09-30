import type { ReactNode } from 'react';
import { useMatches, useLocation } from 'react-router';
import { NavRail } from './NavRail';
import { RightRail } from './RightRail';
import { BottomTabBar } from './BottomTabBar';
import { TopBar } from './TopBar';
import { FeedHeader } from './FeedHeader';
import { Footer } from './Footer';

interface RouteHandle {
  hideRightRail?: boolean;
  hideFooter?: boolean;
  mobileFooter?: boolean;
}

export function AppShell({ children }: { children: ReactNode }) {
  const matches = useMatches();
  const { pathname } = useLocation();
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

        <div className="flex flex-1 min-w-0">
          {/* Centre column: header sits above main only */}
          <div className="flex flex-col flex-1 min-w-0">
            {isHome ? <FeedHeader /> : <TopBar />}
            <main
              id="main-scroll"
              className="main-scroll-performance flex-1 min-h-0 min-w-0 overflow-x-hidden overflow-y-auto pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0"
              style={{ scrollbarWidth: 'none' }}
            >
              {children}
              {!handle.hideFooter && <Footer hiddenOnMobile={!handle.mobileFooter} />}
            </main>
          </div>

          {!handle.hideRightRail && <RightRail />}
        </div>
      </div>

      <BottomTabBar />
    </div>
  );
}
