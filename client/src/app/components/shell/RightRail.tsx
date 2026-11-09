import { segment } from '../ui/styles';
import { RailSkeleton } from '../ui/ContentSkeleton';
import { lazy, Suspense, useState } from 'react';
import { useLocation } from 'react-router';
import { useApp } from '../../contexts/AppContext';
import { FooterCompact } from './Footer';
import { useScrollFade, fadeMask } from '../../hooks/useScrollFade';

const PulseRail = lazy(() => import('../posts/PulseRail').then((m) => ({ default: m.PulseRail })));
const InsightsRail = lazy(() =>
  import('./InsightsRail').then((m) => ({ default: m.InsightsRail })),
);

type RailTab = 'pulse' | 'insights';

export function RightRail() {
  const { t, selectedCategory } = useApp();
  const [selectedTab, setTab] = useState<RailTab>('insights');
  // Pulse is a digest of posts, so beside the Posts feed it only repeats the
  // page. Show Insights alone there.
  const onPostsPage = useLocation().pathname.startsWith('/posts');
  const tab: RailTab = onPostsPage ? 'insights' : selectedTab;
  const scrollFade = useScrollFade<HTMLDivElement>();

  const tabButton = (key: RailTab, label: string) => (
    <button
      key={key}
      type="button"
      role="tab"
      id={`rail-tab-${key}`}
      aria-selected={tab === key}
      aria-controls="rail-panel"
      onClick={() => setTab(key)}
      className={`flex-1 min-h-9 ${tab === key ? segment.active : segment.item}`}
    >
      {label}
    </button>
  );

  return (
    <aside
      className="hidden lg:flex min-h-0 min-w-0 flex-col overflow-hidden"
    >
      {/* Tab header — sibling to scroll container, mirrors FeedHeader structure */}
      <div
        className="shrink-0 h-[88px] px-4 flex items-center"
      >
        {onPostsPage ? (
          <h2 id="rail-tab-insights" className="font-poppins text-lg font-bold text-slate-900 dark:text-slate-100">{t.insights}</h2>
        ) : (
          <div
            className={`${segment.track} flex w-full`}
            role="tablist"
            aria-label={`${t.insights} / ${t.pulse}`}
          >
            {tabButton('insights', t.insights)}
            {tabButton('pulse', t.pulse)}
          </div>
        )}
      </div>

      {/* Scrollable content — independent scroll container */}
      <div
        id="rail-panel"
        ref={scrollFade.ref}
        role={onPostsPage ? 'region' : 'tabpanel'}
        aria-labelledby={`rail-tab-${tab}`}
        className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain px-4 pb-6"
        style={{ scrollbarWidth: 'none', ...fadeMask(scrollFade.above, scrollFade.below, 20) }}
      >
        <Suspense fallback={<RailSkeleton dual={selectedCategory === 'all'} />}>
          {tab === 'pulse' ? <PulseRail /> : <InsightsRail />}
        </Suspense>
        <div className="mt-6">
          <FooterCompact />
        </div>
      </div>
    </aside>
  );
}
