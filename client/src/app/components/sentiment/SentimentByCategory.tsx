import { useUiText } from '../../i18n/uiText';
import { Activity, TrendingDown, TrendingUp } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { CATEGORY_BADGE_CLASS, CATEGORY_LABELS, TOPIC_TO_CATEGORY, type Category, type CategoryTopic } from '../../constants';
import { useStatsOverview, type StatsOverview } from '../../hooks/useStats';
import type { SentimentType } from '../../types/sentiment';
import { DonutChart } from './DonutChart';
import { panelBaseClass, chartTextColor, chartMutedColor } from './shared';
import { LoadingIndicator } from '../ui/ContentSkeleton';

const SENTIMENT_COLORS: Record<SentimentType, string> = {
  positive: '#10b981',
  neutral: '#6b7280',
  negative: '#ef4444',
};
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
 */
export function SentimentByCategory() {
  const ui = useUiText();
  const { t, isDark, selectedCategory, setSelectedCategory } = useApp();
  const { data, isPending, isError } = useStatsOverview('all');

  const rows: CategoryRow[] = (data?.byCategory ?? [])
    .map((item) => ({ category: TOPIC_TO_CATEGORY[item.topic as CategoryTopic], total: item.total, sentiments: item.sentiments }))
    .filter((row): row is CategoryRow => Boolean(row.category))
    .sort((a, b) => b.total - a.total);

  const selectedRow = selectedCategory === 'all' ? null : rows.find((row) => row.category === selectedCategory) ?? null;
  const scopeCounts: Counts = selectedRow?.sentiments ?? data?.sentiments ?? { positive: 0, neutral: 0, negative: 0 };
  const scopeTotal = TYPES.reduce((sum, type) => sum + scopeCounts[type], 0);
  const scopeLabel = selectedRow ? ui(CATEGORY_LABELS[selectedRow.category]) : t.allCategories;
  const segments = TYPES.map((type) => ({ name: t[type], value: scopeCounts[type], color: SENTIMENT_COLORS[type], type }));

  const ranked = rows.filter((row) => row.total >= 10);
  const mostPositive = [...ranked].sort((a, b) => b.sentiments.positive / b.total - a.sentiments.positive / a.total)[0];
  const mostNegative = [...ranked].sort((a, b) => b.sentiments.negative / b.total - a.sentiments.negative / a.total)[0];

  const textColor = chartTextColor(isDark);
  const mutedColor = chartMutedColor(isDark);
  const box = `rounded-xl border p-3 ${isDark ? 'border-slate-700 bg-slate-900/30' : 'border-gray-100 bg-gray-50/70'}`;
  const loading = <div className="grid min-h-44 place-items-center"><LoadingIndicator label={t.loading} /></div>;
  const failed = <p role="alert" className="text-sm" style={{ color: mutedColor }}>{t.fetchFailed}</p>;

  return (
    <div className={`rounded-2xl border shadow-lg p-4 ${panelBaseClass(isDark)}`}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
          <Activity size={13} className="text-white" />
        </div>
        <h3 className={`font-poppins text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>
          {t.sentimentDistribution}
        </h3>
      </div>

      <div className="space-y-3">
        <section className={box} aria-label={`${t.sentimentDistribution}: ${scopeLabel}`}>
          <div className="flex items-center justify-between gap-2 text-[11px] mb-2">
            <span className={`font-semibold ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>{selectedRow ? ui('Selected category') : ui('Overall')}</span>
            <span className={`px-2 py-0.5 rounded-full font-semibold ${selectedRow ? CATEGORY_BADGE_CLASS[selectedRow.category] : isDark ? 'bg-slate-700 text-slate-300' : 'bg-gray-100 text-gray-700'}`}>
              {scopeLabel}
            </span>
          </div>
          {isPending ? loading : isError ? failed : <>
            <DonutChart segments={segments} isDark={isDark} />
            <div className="space-y-2">
              {segments.map((item) => {
                const percentage = share(item.value, scopeTotal);
                return (
                  <div key={item.type} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: item.color }} />
                      <span className="text-xs flex-1 truncate" style={{ color: textColor }}>{item.name}</span>
                      <span className="text-xs font-semibold tabular-nums" style={{ color: item.color }}>{item.value} ({percentage}%)</span>
                    </div>
                    <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-slate-700' : 'bg-gray-100'}`}>
                      <div className="h-full rounded-full transition-[width] duration-300 ease-out" style={{ width: `${percentage}%`, background: item.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between text-[11px] pt-2">
              <span style={{ color: mutedColor }}>{ui('Articles analysed')}</span>
              <span className="font-semibold tabular-nums" style={{ color: textColor }}>{scopeTotal}</span>
            </div>
          </>}
        </section>

        <section className={box} aria-label={ui('All categories ranked')}>
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className={`text-[11px] font-semibold ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>{ui('All categories ranked')}</span>
            <span className="text-[11px]" style={{ color: mutedColor }}>{ui('by article count')}</span>
          </div>
          {isPending ? loading : isError ? failed : <>
            {(mostPositive || mostNegative) && (
              <div className="mb-2 flex flex-wrap gap-1.5 text-[11px]">
                {mostPositive && <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${isDark ? 'bg-emerald-900/40 text-emerald-300' : 'bg-emerald-50 text-emerald-700'}`}>
                  <TrendingUp size={12} />{ui('Most positive')}: {ui(CATEGORY_LABELS[mostPositive.category])} {share(mostPositive.sentiments.positive, mostPositive.total)}%
                </span>}
                {mostNegative && <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${isDark ? 'bg-red-900/40 text-red-300' : 'bg-red-50 text-red-700'}`}>
                  <TrendingDown size={12} />{ui('Most negative')}: {ui(CATEGORY_LABELS[mostNegative.category])} {share(mostNegative.sentiments.negative, mostNegative.total)}%
                </span>}
              </div>
            )}
            <ol className="space-y-1">
              {rows.map((row, index) => {
                const active = row.category === selectedCategory;
                return (
                  <li key={row.category}>
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => setSelectedCategory(active ? 'all' : row.category)}
                      title={ui(active ? 'Show all categories' : 'Filter by this category')}
                      className={`w-full rounded-lg px-2 py-2 text-left transition-colors ${active ? isDark ? 'bg-cyan-500/15 ring-1 ring-cyan-500/40' : 'bg-cyan-50 ring-1 ring-cyan-200' : isDark ? 'hover:bg-slate-800' : 'hover:bg-white'}`}
                    >
                      <div className="flex items-center gap-2 text-xs">
                        <span className="w-4 text-right tabular-nums" style={{ color: mutedColor }}>{index + 1}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${CATEGORY_BADGE_CLASS[row.category]}`}>{ui(CATEGORY_LABELS[row.category])}</span>
                        <span className="ml-auto font-semibold tabular-nums" style={{ color: textColor }}>{row.total}</span>
                      </div>
                      <div className="mt-1.5 ml-6 flex h-2 overflow-hidden rounded-full" aria-hidden="true">
                        {TYPES.map((type) => (
                          <div key={type} style={{ width: `${share(row.sentiments[type], row.total)}%`, background: SENTIMENT_COLORS[type] }} />
                        ))}
                      </div>
                      <p className="mt-1 ml-6 text-[11px] tabular-nums" style={{ color: mutedColor }}>
                        {TYPES.map((type) => `${t[type]} ${share(row.sentiments[type], row.total)}%`).join(' · ')}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ol>
            <p className="mt-2 text-[11px]" style={{ color: mutedColor }}>{ui('Choose a category to filter the feed, Insights and Pulse.')}</p>
          </>}
        </section>
      </div>
    </div>
  );
}
