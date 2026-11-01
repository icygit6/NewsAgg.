import { useState, type ReactNode } from 'react';
import { useUiPunctuation, useUiText } from '../../i18n/uiText';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { InsightMark } from '../ui/InsightMark';
import { useApp } from '../../contexts/AppContext';
import { CATEGORY_BADGE_CLASS, CATEGORY_LABELS, TOPIC_TO_CATEGORY, type Category, type CategoryTopic } from '../../constants';
import { useStatsOverview, type StatsOverview } from '../../hooks/useStats';
import type { SentimentType } from '../../types/sentiment';
import { SentimentExplorer } from './SentimentExplorer';
import { DonutChart } from './DonutChart';
import { SentimentReasons } from './SentimentReasons';
import { panelBaseClass, chartTextColor, chartMutedColor } from './shared';
import { LoadingIndicator } from '../ui/ContentSkeleton';
import { RollingNumber } from '../ui/RollingNumber';
import { SENTIMENT_COLOR } from '../ui/chartTheme';
import { LoadError } from '../ui/ErrorNote';

const TYPES: SentimentType[] = ['positive', 'neutral', 'negative'];

type Counts = StatsOverview['sentiments'];
interface CategoryRow { category: Category; total: number; sentiments: Counts }

const share = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

/**
 * Sentiment for the published dataset. The donut follows the active category
 * filter (or all categories); below it every category is ranked by volume
 * with its positive/neutral/negative split, so readers can compare them at
 * once instead of waiting for a 10-second rotation. Everything comes from a
 * single /api/stats/overview request. Choosing a row applies that category to
 * the whole site (feed, insights and Pulse); choosing it again clears it.
 *
 * Without `part` everything stacks in one card. The Insights page renders
 * each part as its own card so the page can pair them in aligned rows.
 */
export function SentimentByCategory({ part }: { part?: 'overview' | 'ranking' }) {
  const [donuts, setDonuts] = useState(false);
  const ui = useUiText();
  const p = useUiPunctuation();
  const { t, isDark, selectedCategory, setSelectedCategory } = useApp();
  const { data, isPending, isError } = useStatsOverview(selectedCategory);

  const rows: CategoryRow[] = (data?.byCategory ?? [])
    .map((item) => ({ category: TOPIC_TO_CATEGORY[item.topic as CategoryTopic], total: item.total, sentiments: item.sentiments }))
    .filter((row): row is CategoryRow => Boolean(row.category))
    .sort((a, b) => b.total - a.total);

  const selectedRow = selectedCategory === 'all' ? null : rows.find((row) => row.category === selectedCategory) ?? null;
  const scopeCounts: Counts = selectedRow?.sentiments ?? data?.sentiments ?? { positive: 0, neutral: 0, negative: 0 };
  const scopeTotal = TYPES.reduce((sum, type) => sum + scopeCounts[type], 0);
  const scopeLabel = selectedRow ? ui(CATEGORY_LABELS[selectedRow.category]) : t.allCategories;

  const ranked = rows.filter((row) => row.total >= 10);
  const mostPositive = [...ranked].sort((a, b) => b.sentiments.positive / b.total - a.sentiments.positive / a.total)[0];
  const mostNegative = [...ranked].sort((a, b) => b.sentiments.negative / b.total - a.sentiments.negative / a.total)[0];

  const textColor = chartTextColor(isDark);
  const mutedColor = chartMutedColor(isDark);
  // Stacked in one card the sections need their own tinted boxes; as
  // separate cards (Insights) the card itself is the box.
  const box = part ? '' : `rounded-xl p-3 bg-slate-50 dark:bg-slate-800/60`;
  const scopeChip = <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${selectedRow ? CATEGORY_BADGE_CLASS[selectedRow.category] : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'}`}>{scopeLabel}</span>;
  const loading = <div className="grid min-h-44 place-items-center"><LoadingIndicator label={t.loading} /></div>;
  const failed = <LoadError message={t.fetchFailed} />;
  const scopeRow = selectedRow ? data?.byCategory?.find(row => row.topic === CATEGORY_LABELS[selectedRow.category]) : undefined;
  const evidence = selectedRow ? scopeRow?.evidence : data?.evidence;

  const card = (mark: 'sentiment' | 'categories', title: string, children: ReactNode, aside?: ReactNode) => (
    <div className={`rounded-2xl border p-4 ${panelBaseClass()}`}>
      <div className="flex items-center gap-2 mb-3">
        <InsightMark kind={mark} />
        <h3 className={`font-poppins text-sm font-semibold text-slate-800 dark:text-slate-200`}>
          {title}
        </h3>
        {aside && <span className="ml-auto">{aside}</span>}
      </div>
      {children}
    </div>
  );

  const overview = (
        <section className={box} aria-label={`${t.sentimentDistribution}: ${scopeLabel}`}>
          {!part && <div className="flex items-center justify-between gap-2 text-xs mb-2">
            <span className={`font-semibold text-slate-700 dark:text-slate-300`}>{selectedRow ? ui('Selected category') : ui('Overall')}</span>
            {scopeChip}
          </div>}
          {isPending ? loading : isError ? failed : <>
            <SentimentExplorer counts={scopeCounts} sources={selectedRow ? scopeRow?.bySource : data?.bySource} scopeKey={selectedCategory} />
            {!part && <div className="flex items-center justify-between text-xs pt-2">
              <span style={{ color: mutedColor }}>{ui('Articles analysed')}</span>
              <span className="font-semibold tabular-nums" style={{ color: textColor }}>{scopeTotal}</span>
            </div>}
            <SentimentReasons show={part ? 'open' : 'all'} evidence={evidence} />
          </>}
        </section>
  );

  const ranking = selectedCategory === 'all' && <section className={box} aria-label={ui('All categories ranked')}>
          {!part && <div className="flex items-center justify-between gap-2 mb-1">
            <span className={`text-xs font-semibold text-slate-700 dark:text-slate-300`}>{ui('All categories ranked')}</span>
            <span className="text-xs" style={{ color: mutedColor }}>{ui('by article count')}</span>
          </div>}
          {isPending ? loading : isError ? failed : <>
            {(mostPositive || mostNegative) && (
              <div className="mb-2 flex flex-wrap gap-1.5 text-xs">
                {mostPositive && <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300`}>
                  <TrendingUp size={14} />{ui('Most positive')}{p.colon}{ui(CATEGORY_LABELS[mostPositive.category])} {share(mostPositive.sentiments.positive, mostPositive.total)}%
                </span>}
                {mostNegative && <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-300`}>
                  <TrendingDown size={14} />{ui('Most negative')}{p.colon}{ui(CATEGORY_LABELS[mostNegative.category])} {share(mostNegative.sentiments.negative, mostNegative.total)}%
                </span>}
              </div>
            )}
            <div className="my-3 flex gap-2" role="group" aria-label={ui('Category chart style')}>
              {[false, true].map(value => <button key={String(value)} type="button" aria-pressed={donuts === value} onClick={() => setDonuts(value)} className={`rounded-lg px-3 py-2 text-[13px] font-semibold ${donuts === value ? 'bg-[var(--brand)] text-white' : 'border border-current/20'}`}>{ui(value ? 'Donuts' : 'Bars')}</button>)}
            </div>
            {donuts ? <div className="grid grid-cols-2 gap-4">{rows.map(row => <section key={row.category} className="min-w-0 border-b border-current/10 pb-3">
              <button type="button" aria-pressed={false} onClick={() => setSelectedCategory(row.category)} className="w-full rounded-lg py-2 text-sm font-semibold text-[var(--brand)]">{ui(CATEGORY_LABELS[row.category])} · {row.total}</button>
              <div className="flex flex-wrap items-center justify-center gap-x-5">
              <DonutChart size="clamp(112px, 12vw, 168px)" segments={TYPES.map(type => ({ name: t[type], value: row.sentiments[type], color: SENTIMENT_COLOR[type] }))} isDark={isDark} />
              <dl className="w-full min-w-0 space-y-2 pb-3 text-xs">{TYPES.map(type => <div key={type} className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1"><dt className="inline-flex items-center gap-1.5" style={{color:SENTIMENT_COLOR[type]}}><span className="h-2 w-2 shrink-0 rounded-full" style={{background:SENTIMENT_COLOR[type]}} />{t[type]}</dt><dd className="tabular-nums font-semibold" style={{color:SENTIMENT_COLOR[type]}}>{row.sentiments[type].toLocaleString()} · {share(row.sentiments[type], row.total)}%</dd></div>)}</dl>
              </div>
            </section>)}</div> : <ol className="space-y-1">
              {rows.map((row, index) => {
                const active = false;
                return (
                  <li key={row.category}>
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => setSelectedCategory(active ? 'all' : row.category)}
                      title={ui(active ? 'Show all categories' : 'Filter by this category')}
                      className={`w-full rounded-lg px-2 py-2 text-left transition-colors ${active ? 'bg-blue-50 ring-1 ring-blue-200 dark:bg-blue-500/15 dark:ring-1 dark:ring-blue-500/40' : 'hover:bg-white dark:hover:bg-slate-800'}`}
                    >
                      <div className="flex items-center gap-2 text-xs">
                        <span className="w-4 text-right tabular-nums" style={{ color: mutedColor }}>{index + 1}</span>
                        <span className="font-semibold" style={{ color: textColor }}>{ui(CATEGORY_LABELS[row.category])}</span>
                        <span className="ml-auto font-semibold tabular-nums" style={{ color: textColor }}><RollingNumber value={row.total} /></span>
                      </div>
                      <div className="chart-grow mt-1.5 ml-6 flex h-2 overflow-hidden rounded-full" aria-hidden="true">
                        {TYPES.map((type) => (
                          <div key={type} style={{ width: `${share(row.sentiments[type], row.total)}%`, background: SENTIMENT_COLOR[type] }} />
                        ))}
                      </div>
                      <p className="mt-1 ml-6 text-xs tabular-nums" style={{ color: mutedColor }}>
                        {TYPES.map((type, index) => <span key={type}>{index > 0 && ' · '}{t[type]} {share(row.sentiments[type], row.total)}%</span>)}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ol>}
            <p className="mt-2 text-xs" style={{ color: mutedColor }}>{ui('Choose a category to filter the feed, Insights and Pulse.')}</p>
          </>}
        </section>;

  if (part === 'overview') return card('sentiment', t.sentimentDistribution, overview, scopeChip);
  if (part === 'ranking') return ranking ? card('categories', ui('Sentiment by category'), ranking, <span className="text-xs" style={{ color: mutedColor }}>{ui('by article count')}</span>) : null;
  return card('sentiment', t.sentimentDistribution, <div className="space-y-3">{overview}{ranking}</div>);
}
