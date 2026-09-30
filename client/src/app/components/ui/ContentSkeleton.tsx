import { useUiText } from '../../i18n/uiText';
/** Content-shaped loading placeholders; decorative blocks stay hidden from AT. */
export function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`rounded-lg bg-slate-200/80 dark:bg-slate-700/60 motion-safe:animate-pulse ${className}`} />;
}

export function FeedSkeleton({ count = 6, hero = false, label = 'Loading articles' }: { count?: number; hero?: boolean; label?: string }) {
  return (
    <div role="status" aria-label={label} className="w-full py-4">
      <span className="sr-only">{label}</span>
      {hero && <SkeletonBlock className="mb-8 h-52 sm:h-72 w-full rounded-2xl" />}
      <div aria-hidden="true" className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {Array.from({ length: count }, (_, index) => (
          <div key={index} className="min-h-[500px] overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <SkeletonBlock className="h-52 rounded-none sm:h-56 lg:h-60" />
            <div className="space-y-5 p-5">
              <div className="flex items-center gap-2">
                <SkeletonBlock className="h-9 w-9 rounded-full" />
                <SkeletonBlock className="h-3 w-24" />
              </div>
              <div className="space-y-2.5">
                <SkeletonBlock className="h-6 w-full" />
                <SkeletonBlock className="h-6 w-full" />
                <SkeletonBlock className="h-6 w-2/3" />
              </div>
              <div className="flex gap-2"><SkeletonBlock className="h-5 w-16" /><SkeletonBlock className="h-5 w-20" /></div>
              <div className="flex justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                <SkeletonBlock className="h-3 w-16" /><SkeletonBlock className="h-3 w-20" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ListSkeleton({ count = 3, label = 'Loading content' }: { count?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="w-full space-y-3 py-4">
      <span className="sr-only">{label}</span>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} aria-hidden="true" className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
          <div className="flex items-center gap-3"><SkeletonBlock className="h-9 w-9 rounded-full" /><SkeletonBlock className="h-4 w-28" /></div>
          <SkeletonBlock className="h-4 w-full" /><SkeletonBlock className="h-4 w-3/4" />
        </div>
      ))}
    </div>
  );
}

export function PanelSkeleton() {
  const ui = useUiText();
  return (
    <div role="status" aria-label={ui("Loading insights")} className="space-y-4 py-4">
      <span className="sr-only">{ui("Loading insights")}</span>
      {[0, 1].map(index => (
        <div key={index} aria-hidden="true" className="space-y-4 rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
          <SkeletonBlock className="h-5 w-1/2" />
          <SkeletonBlock className="mx-auto h-28 w-28 rounded-full" />
          <SkeletonBlock className="h-3 w-full" />
          <SkeletonBlock className="h-3 w-3/4" />
        </div>
      ))}
    </div>
  );
}

export function ArticleSkeleton({ label = 'Loading article' }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-6">
      <span className="sr-only">{label}</span>
      <SkeletonBlock className="h-8 w-32" />
      <SkeletonBlock className="h-56 w-full rounded-2xl sm:h-80" />
      <SkeletonBlock className="h-9 w-5/6" />
      <SkeletonBlock className="h-9 w-2/3" />
      <SkeletonBlock className="h-4 w-48" />
      <div aria-hidden="true" className="space-y-3">
        {[0, 1, 2, 3, 4].map(index => <SkeletonBlock key={index} className={`h-4 ${index === 4 ? 'w-2/3' : 'w-full'}`} />)}
      </div>
    </div>
  );
}
