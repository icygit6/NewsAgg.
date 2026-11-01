import { RailSkeleton } from '../ui/ContentSkeleton';
import { lazy, Suspense, useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { FooterCompact } from './Footer';
import { useScrollFade, fadeMask } from '../../hooks/useScrollFade';

const PulseRail = lazy(() => import('../posts/PulseRail').then((m) => ({ default: m.PulseRail })));
const InsightsRail = lazy(() =>
  import('./InsightsRail').then((m) => ({ default: m.InsightsRail })),
);

type RailTab = 'pulse' | 'insights';

export function RightRail() {
  const { t, isDark, selectedCategory } = useApp();
  const [tab, setTab] = useState<RailTab>('insights');
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
      className={`flex-1 py-2 text-sm font-semibold rounded-full transition-colors ${
        tab === key
          ? 'text-white'
          : isDark
            ? 'text-slate-400 hover:text-slate-200'
            : 'text-slate-500 hover:text-slate-800'
      }`}
      style={tab === key ? { background: 'var(--brand)' } : undefined}
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
        <div
          className={`flex gap-1 rounded-full border p-1 w-full ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
          }`}
          role="tablist"
          aria-label={`${t.insights} / ${t.pulse}`}
        >
          {tabButton('insights', t.insights)}
          {tabButton('pulse', t.pulse)}
        </div>
      </div>

      {/* Scrollable content — independent scroll container */}
      <div
        id="rail-panel"
        ref={scrollFade.ref}
        role="tabpanel"
        aria-labelledby={`rail-tab-${tab}`}
        className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain px-4 pb-6"
        style={{ scrollbarWidth: 'none', ...fadeMask(scrollFade.above, scrollFade.below, 20) }}
      >
        <Suspense fallback={<RailSkeleton dual={selectedCategory === 'all'} />}>
          {tab === 'pulse' ? <PulseRail /> : <InsightsRail />}
        </Suspense>
        <div className="mt-6 pt-4">
          <FooterCompact />
        </div>
      </div>
    </aside>
  );
}
