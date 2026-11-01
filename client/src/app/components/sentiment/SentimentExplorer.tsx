import { useEffect, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { useApp } from '../../contexts/AppContext';
import type { SourceSentiments } from '../../hooks/useStats';
import type { SentimentType } from '../../types/sentiment';
import { RollingNumber } from '../ui/RollingNumber';
import { SourceLogo } from '../ui/SourceLogo';
import { SENTIMENT_COLOR } from '../ui/chartTheme';
import { DonutChart } from './DonutChart';

const types: SentimentType[] = ['positive', 'neutral', 'negative'];

export function SentimentExplorer({ counts, sources = [], scopeKey }: {
  counts: Record<SentimentType, number>; sources?: SourceSentiments[]; scopeKey: string;
}) {
  const { t, isDark, language } = useApp();
  const zh = language === 'zhTW' || language === 'zhCN';
  const reducedMotion = useReducedMotion();
  const [active, setActive] = useState<SentimentType | null>(null);
  const [logoIndex, setLogoIndex] = useState(0);
  const total = types.reduce((sum, type) => sum + counts[type], 0);
  const signature = `${scopeKey}:${types.map(type => counts[type]).join(',')}:${sources.map(source => `${source.id}:${source.total}`).join(',')}`;
  useEffect(() => { setActive(null); setLogoIndex(0); }, [signature]);
  const logos = sources.filter(source => source.total > 0);
  useEffect(() => {
    if (reducedMotion || logos.length < 2) return;
    const timer = window.setInterval(() => { if (!document.hidden) setLogoIndex(index => (index + 1) % logos.length); }, 4000);
    return () => window.clearInterval(timer);
  }, [reducedMotion, logos.length]);
  const selectedCount = active ? counts[active] : 0;
  const percent = (count: number, denominator: number) => denominator ? Math.round(count / denominator * 100) : 0;
  const center = logos.length ? <div aria-live="off" className="relative h-16 w-20">
    {logos.map((source, index) => <div key={source.id ?? source.name} aria-hidden={index !== logoIndex % logos.length} className="absolute inset-0 flex flex-col items-center justify-center gap-1 transition-opacity duration-200 motion-reduce:transition-none" style={{ opacity: index === logoIndex % logos.length ? 1 : 0 }}>
      <SourceLogo source={source} isDark={isDark} className="h-10 w-10" />
    </div>)}
  </div> : undefined;

  return <div className="sentiment-visual-host" data-testid="sentiment-explorer"
    onPointerLeave={event => { if (event.pointerType === 'mouse') setActive(null); }}
    onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setActive(null); }}
    onKeyDown={event => { if (event.key === 'Escape') setActive(null); }}>
    <div className="sentiment-visual">
      <div className="min-h-60 min-w-0 flex flex-col justify-center" aria-live="polite" aria-atomic="true">
        {active ? <div data-testid="sentiment-source-detail">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <strong className="text-sm" style={{ color: SENTIMENT_COLOR[active] }}>{t[active]}</strong>
            <button type="button" onClick={() => setActive(null)} className="rounded px-1 py-2 text-xs text-[var(--brand)] hover:underline">{zh ? '全部情緒' : 'All sentiments'}</button>
          </div>
          <p className="mb-3 text-lg font-semibold tabular-nums" style={{ color: SENTIMENT_COLOR[active] }}><RollingNumber value={selectedCount} duration={0.2} /> · <RollingNumber value={percent(selectedCount, total)} duration={0.2} />%</p>
          <p className="mb-2 text-xs leading-4 text-slate-600 dark:text-slate-400">{zh ? '各媒體在此情緒中的篇數與占比' : 'Source counts and shares of this sentiment'}</p>
          {sources.length ? <ul className="space-y-2">{sources.map(source => <li key={source.id ?? source.name} className="flex min-w-0 items-center gap-2 text-xs">
            <SourceLogo source={source} isDark={isDark} className="h-6 w-6" />
            <span className="min-w-0 flex-1 truncate" title={source.name}>{source.name}</span>
            <span className="shrink-0 font-semibold tabular-nums" style={{ color: SENTIMENT_COLOR[active] }}><RollingNumber value={source.sentiments[active]} duration={0.2} /> · <RollingNumber value={percent(source.sentiments[active], selectedCount)} duration={0.2} />%</span>
          </li>)}</ul> : <p className="text-xs">{zh ? '目前沒有來源明細。' : 'Source breakdown is unavailable.'}</p>}
        </div> : <div className="space-y-3">{types.map(type => <button key={type} type="button" disabled={!counts[type]} onClick={() => setActive(type)} className="block w-full rounded-lg py-1 text-left disabled:opacity-50">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs"><span className="h-2 w-2 rounded-full" style={{ background: SENTIMENT_COLOR[type] }} /><span className="flex-1" style={{color: SENTIMENT_COLOR[type]}}>{t[type]}</span><strong className="tabular-nums" style={{ color: SENTIMENT_COLOR[type] }}>{counts[type].toLocaleString()} · {percent(counts[type], total)}%</strong></span>
          <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"><span className="block h-full origin-left rounded-full transition-transform duration-200 motion-reduce:transition-none" style={{ background: SENTIMENT_COLOR[type], transform: `scaleX(${total ? counts[type] / total : 0})` }} /></span>
        </button>)}</div>}
      </div>
      <DonutChart size="clamp(152px, 40cqw, 192px)" isDark={isDark} transitionKey={signature}
        segments={types.map(type => ({ name: t[type], value: counts[type], color: SENTIMENT_COLOR[type] }))}
        activeName={active ? t[active] : null} onActiveChange={name => setActive(types.find(type => t[type] === name) ?? null)} center={center} />
    </div>
  </div>;
}
