import { useUiText } from '../../i18n/uiText';
import { BrandLogo } from './BrandLogo';
import { useIsMobile } from './use-mobile';
import { useState, type CSSProperties } from 'react';

/** Every loading state in the app is built from SkeletonBlock, so they share one
 * colour, one radius and one shimmer (`.skeleton` in styles/theme.css). Each
 * composite below mirrors the shape of the component it stands in for, so the
 * page does not jump when the real content arrives. Decorative blocks stay
 * hidden from assistive technology; the wrapper announces the busy state. */
export function SkeletonBlock({ className = '' }: { className?: string }) {
  // New async sections join the same document-time phase instead of starting
  // their own unrelated shimmer when a request happens to finish.
  const [phase] = useState(() => `${-(performance.now() % 1800)}ms`);
  return <div aria-hidden="true" style={{ '--skeleton-delay': phase } as CSSProperties} className={`skeleton rounded-lg ${className}`} />;
}

export function ExplanationSkeleton() {
  const ui = useUiText();
  return <div role="status" aria-busy="true" aria-label={ui('Reading the article to explain its sentiment…')} className="space-y-2 py-2">
    <span className="sr-only">{ui('Reading the article to explain its sentiment…')}</span>
    <SkeletonBlock className="h-3 w-full" /><SkeletonBlock className="h-3 w-full" /><SkeletonBlock className="h-3 w-4/5" />
  </div>;
}

/** The hero carousel's height, shared so its skeleton and the real thing match. */
export const HERO_HEIGHT = 'h-[300px] sm:h-[360px] md:h-[420px]';

export function HeroSkeleton() {
  return <SkeletonBlock className={`${HERO_HEIGHT} w-full rounded-2xl`} />;
}

// Same opaque surface as the panels it stands in for (sentiment/shared.ts panelBaseClass).
const PANEL = 'rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900';

function PanelHeader({ badge = false, title = 'w-32' }: { badge?: boolean; title?: string }) {
  return (
    <div aria-hidden="true" className="mb-3 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <SkeletonBlock className="h-6 w-6" />
        <SkeletonBlock className={`h-4 ${title}`} />
      </div>
      {badge && <SkeletonBlock className="h-5 w-16 rounded-full" />}
    </div>
  );
}

/** Donut and legend, as in the sentiment chart. */
function ChartPanel({ dual = false }: { dual?: boolean }) {
  return (
    <div aria-hidden="true" className={PANEL}>
      <PanelHeader title="w-36" />
      {Array.from({ length: dual ? 2 : 1 }, (_, index) => <div key={index} className={dual ? 'mb-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60' : ''}>
      <div className="sentiment-visual-host">
        <div className="sentiment-visual">
          <div className="flex min-h-60 flex-col justify-center gap-3">
            {[0, 1, 2].map(row => <div key={row} className="space-y-2">
              <div className="flex justify-between gap-3"><SkeletonBlock className="h-3 w-20" /><SkeletonBlock className="h-3 w-12" /></div>
              <SkeletonBlock className="h-1.5 w-full rounded-full" />
            </div>)}
          </div>
          <div className="flex justify-center py-2"><div style={{ width: 'clamp(152px, 40cqw, 192px)' }}><SkeletonBlock className="aspect-square w-full rounded-full" /></div></div>
        </div>
      </div>
      <SkeletonBlock className="mt-3 h-3 w-full" />
      <div className="mt-3 space-y-2 border-t border-slate-200 pt-3 dark:border-slate-700">
        <SkeletonBlock className="h-3 w-24" /><SkeletonBlock className="h-3 w-full" /><SkeletonBlock className="h-3 w-4/5" /><SkeletonBlock className="my-3 h-3 w-36" />
      </div>
      </div>)}
    </div>
  );
}

/** Header with an article count, a category line and two-line headlines, as in Live View. */
function LiveViewPanel() {
  return (
    <div aria-hidden="true" className={PANEL}>
      <PanelHeader badge title="w-20" />
      <SkeletonBlock className="mb-3 h-3 w-32" />
      <div className="space-y-3.5">
        {[0, 1, 2, 3].map(index => (
          <div key={index} className="space-y-2 px-2.5">
            <SkeletonBlock className="h-4 w-full" />
            <SkeletonBlock className="h-4 w-4/5" />
            <SkeletonBlock className="h-3 w-40" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Ranked keywords with a bar each, as in Trending Topics. */
export function TrendingPanel() {
  return (
    <div aria-hidden="true" className={PANEL}>
      <PanelHeader title="w-32" />
      <div className="space-y-3.5">
        {[0, 1, 2, 3, 4].map(index => (
          <div key={index} className="space-y-1.5">
            <div className="flex justify-between"><SkeletonBlock className="h-3 w-24" /><SkeletonBlock className="h-3 w-8" /></div>
            <SkeletonBlock className="h-2 w-full rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

function AuthorsPanel() {
  return <div aria-hidden="true" className={PANEL}>
    <PanelHeader title="w-36" />
    <SkeletonBlock className="mb-4 h-8 w-full" />
    <div className="space-y-4">{[0, 1, 2, 3, 4, 5].map(row => <div key={row} className="flex justify-between gap-3">
      <div className="space-y-2"><SkeletonBlock className="h-3 w-32" /><SkeletonBlock className="h-2.5 w-20" /></div>
      <SkeletonBlock className="h-3 w-8" />
    </div>)}</div>
  </div>;
}

export function FeedSkeleton({ count = 6, hero = false, label }: { count?: number; hero?: boolean; label?: string }) {
  const ui = useUiText();
  label ??= ui('Loading articles');
  return (
    <div role="status" aria-label={label} aria-busy="true" className="@container w-full py-4">
      <span className="sr-only">{label}</span>
      {hero && <div className="mb-8"><HeroSkeleton /></div>}
      <div aria-hidden="true" className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4">
        {hero && <div className="col-span-full overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 sm:grid sm:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <SkeletonBlock className="aspect-[16/10] rounded-none sm:aspect-auto sm:min-h-[18rem] lg:min-h-[22rem]" />
          <div className="space-y-4 p-4 lg:p-8">
            <SkeletonBlock className="h-5 w-20 rounded-full" />
            <SkeletonBlock className="h-7 w-full" /><SkeletonBlock className="h-7 w-4/5" />
            <SkeletonBlock className="h-10 w-full lg:h-16" />
            <SkeletonBlock className="h-7 w-28" />
          </div>
        </div>}
        {Array.from({ length: count }, (_, index) => (
          <div key={index} className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <SkeletonBlock className="aspect-[16/10] rounded-none" />
            <div className="space-y-2 p-2.5 sm:p-3">
              <div className="flex items-center gap-2">
                <SkeletonBlock className="h-7 w-7 shrink-0 rounded-full sm:h-8 sm:w-8" />
                <SkeletonBlock className="h-3 w-20 max-w-full" />
              </div>
              <div className="space-y-1">
                <SkeletonBlock className="h-4 w-full sm:h-5" />
                <SkeletonBlock className="h-4 w-full sm:h-5" />
                <SkeletonBlock className="h-4 w-2/3 sm:h-5" />
              </div>
              {/* The news card's gap above its keywords (the bookmark card's action-row height). */}
              <div className="h-9" />
              <div className="flex gap-2"><SkeletonBlock className="h-5 w-16" /><SkeletonBlock className="h-5 w-20" /></div>
              <div className="flex justify-between gap-2 border-t border-slate-100 pt-2 dark:border-slate-800">
                <SkeletonBlock className="h-3 w-16" /><SkeletonBlock className="h-3 w-20" />
              </div>
              <SkeletonBlock className="h-2.5 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Posts, comments and bookmarks: avatar and handle, category pill, text, actions. */
export function ListSkeleton({ count = 3, label }: { count?: number; label?: string }) {
  const ui = useUiText();
  label ??= ui('Loading content');
  return (
    <div role="status" aria-label={label} aria-busy="true" className="w-full space-y-3 py-4">
      <span className="sr-only">{label}</span>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} aria-hidden="true" className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2.5">
            <SkeletonBlock className="h-9 w-9 shrink-0 rounded-full" />
            <div className="space-y-2"><SkeletonBlock className="h-4 w-28" /><SkeletonBlock className="h-3 w-20" /></div>
          </div>
          <SkeletonBlock className="h-5 w-16 rounded-full" />
          <div className="space-y-2"><SkeletonBlock className="h-4 w-full" /><SkeletonBlock className="h-4 w-3/4" /></div>
          <div className="flex gap-2"><SkeletonBlock className="h-6 w-12 rounded-full" /><SkeletonBlock className="h-6 w-12 rounded-full" /></div>
        </div>
      ))}
    </div>
  );
}

/** The Insights page: panels side by side. */
export function PanelSkeleton() {
  const ui = useUiText();
  return (
    <div role="status" aria-label={ui("Loading insights")} aria-busy="true" className="grid gap-4 py-4 lg:grid-cols-2">
      <span className="sr-only">{ui("Loading insights")}</span>
      <ChartPanel />
      <div className="min-w-0 space-y-4"><LiveViewPanel /><TrendingPanel /><AuthorsPanel /></div>
    </div>
  );
}

/** The right rail: sentiment, Live View and Trending Topics, stacked like the real rail. */
export function RailSkeleton({ dual = true }: { dual?: boolean }) {
  const ui = useUiText();
  return (
    <div role="status" aria-label={ui("Loading insights")} aria-busy="true" className="w-full space-y-4">
      <span className="sr-only">{ui("Loading insights")}</span>
      <ChartPanel dual={dual} />
      <LiveViewPanel />
      <TrendingPanel />
      <AuthorsPanel />
    </div>
  );
}

export function ArticleSkeleton({ label }: { label?: string }) {
  const ui = useUiText();
  label ??= ui('Loading article');
  return (
    <div role="status" aria-label={label} aria-busy="true" className="space-y-3 px-4 py-4 md:px-6 lg:flex lg:h-full lg:min-h-0 lg:flex-col">
      <span className="sr-only">{label}</span>
      <SkeletonBlock className="h-8 w-32" />
      <div className="grid min-h-0 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:overflow-hidden">
        <div className="min-w-0 space-y-5">
          <SkeletonBlock className="h-10 w-52 rounded-full" />
          <div className="grid items-center gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <SkeletonBlock className="aspect-[16/10] w-full rounded-2xl" />
            <div className="space-y-3"><SkeletonBlock className="h-7 w-24" /><SkeletonBlock className="h-9 w-full" /><SkeletonBlock className="h-9 w-4/5" /><SkeletonBlock className="h-9 w-2/3" /></div>
          </div>
          <SkeletonBlock className="h-4 w-48" />
          <div aria-hidden="true" className="space-y-3">
            {[0, 1, 2, 3, 4].map(index => <SkeletonBlock key={index} className={`h-4 ${index === 4 ? 'w-2/3' : 'w-full'}`} />)}
          </div>
        </div>
        <div className="hidden space-y-4 lg:block">
          <div aria-hidden="true" className={PANEL}><PanelHeader /><SkeletonBlock className="mt-4 h-5 w-16" /><SkeletonBlock className="my-4 h-3 w-full" /><div className="mt-5 space-y-3 border-t border-slate-200 pt-4 dark:border-slate-700"><SkeletonBlock className="h-4 w-36" /><SkeletonBlock className="h-3 w-full" /><SkeletonBlock className="h-3 w-full" /><SkeletonBlock className="h-3 w-4/5" /><SkeletonBlock className="h-4 w-40" /></div><SkeletonBlock className="mt-6 h-3 w-full" /></div>
          <ChartPanel />
        </div>
      </div>
    </div>
  );
}

/** The account drawer while its chunk loads: same panel, same brand lockup, same side. */
export function DrawerSkeleton({ label }: { label?: string }) {
  const ui = useUiText();
  const isMobile = useIsMobile(1024);
  label ??= ui('Loading content');
  return (
    <>
      <div aria-hidden="true" className="fixed inset-0 z-[60] bg-black/30 backdrop-blur-[2px]" />
      <div
        role="status"
        aria-label={label}
        aria-busy="true"
        className={`fixed inset-y-0 z-[70] flex w-[400px] max-w-[95vw] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] flex-col overflow-hidden bg-white shadow-2xl dark:bg-slate-900 ${isMobile ? 'right-0 rounded-l-[28px]' : 'left-0 rounded-r-[28px]'} border-slate-100 dark:border-slate-700`}
      >
        <span className="sr-only">{label}</span>
        <div className="flex items-center gap-2 px-6 py-5">
          <BrandLogo size="sm" />
        </div>
        <div aria-hidden="true" className="space-y-4 px-6 pb-6">
          <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/70">
            <SkeletonBlock className="h-12 w-12 shrink-0 rounded-xl" />
            <div className="flex-1 space-y-2"><SkeletonBlock className="h-4 w-28" /><SkeletonBlock className="h-3 w-40" /></div>
          </div>
          {[0, 1].map(index => (
            <div key={index} className="flex items-center gap-3 px-4">
              <SkeletonBlock className="h-8 w-8 shrink-0" /><SkeletonBlock className="h-4 w-32" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/** Compact progress for actions; same treatment in feeds and account forms. */
export function LoadingIndicator({ label }: { label?: string }) {
  const ui = useUiText();
  return <span role="status" className="inline-flex items-center justify-center gap-2 text-sm">
    <span aria-hidden="true" className="h-4 w-4 shrink-0 rounded-full border-2 border-current border-r-transparent motion-safe:animate-spin" />
    <span>{label ?? ui('Loading content')}</span>
  </span>;
}
