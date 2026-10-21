import { useUiText } from '../../i18n/uiText';
import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Activity } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { CATEGORY_BADGE_CLASS, CATEGORIES, CATEGORY_LABELS } from '../../constants';
import { useStatsOverview, type StatsOverview } from '../../hooks/useStats';
import type { NewsCategoryFilter } from '../../types/article';
import type { SentimentDistributionItem } from '../../types/sentiment';
import { DonutChart } from './DonutChart';
import { panelBaseClass, chartTextColor, chartMutedColor } from './shared';
import { LoadingIndicator } from '../ui/ContentSkeleton';

const toDistribution = (overview: StatsOverview | undefined): SentimentDistributionItem[] =>
  (['positive', 'neutral', 'negative'] as const).map((type) => ({
    type,
    count: overview?.sentiments[type] ?? 0,
  }));

const SENTIMENT_COLORS = {
  positive: '#10b981',
  neutral: '#6b7280',
  negative: '#ef4444',
};

const SENTIMENT_ROTATE_MS = 10000;

export function SentimentChart() {
  const ui = useUiText();
  const { t, isDark, selectedCategory } = useApp();
  const [sentimentCategoryIndex, setSentimentCategoryIndex] = useState(0);

  const rotatingSentimentCategory: NewsCategoryFilter = selectedCategory === 'all'
    ? CATEGORIES[sentimentCategoryIndex]
    : selectedCategory;

  // SQL-side aggregates via /api/stats/overview (no full-dataset download).
  const { data: overallOverview, isPending: overallLoading, isError: overallError } = useStatsOverview('all');
  const { data: categoryOverview, isPending: categoryLoading, isError: categoryError } = useStatsOverview(rotatingSentimentCategory);
  const overallSentimentDistribution = toDistribution(overallOverview);
  const categorySentimentDistribution = toDistribution(categoryOverview);

  // Rotation control: auto-cycle when viewing "all", otherwise lock to the selection.
  useEffect(() => {
    if (selectedCategory === 'all') {
      const id = window.setInterval(
        () => setSentimentCategoryIndex((prev) => (prev + 1) % CATEGORIES.length),
        SENTIMENT_ROTATE_MS
      );
      return () => window.clearInterval(id);
    }
    const categoryIndex = CATEGORIES.indexOf(selectedCategory);
    if (categoryIndex >= 0) setSentimentCategoryIndex(categoryIndex);
  }, [selectedCategory]);

  const handleNextSentimentCategory = () => {
    setSentimentCategoryIndex((prev) => (prev + 1) % CATEGORIES.length);
  };

  const overallSentimentData = overallSentimentDistribution.map((item) => ({
    name: t[item.type],
    value: item.count,
    color: SENTIMENT_COLORS[item.type],
    type: item.type,
  }));

  const categorySentimentData = categorySentimentDistribution.map((item) => ({
    name: t[item.type],
    value: item.count,
    color: SENTIMENT_COLORS[item.type],
    type: item.type,
  }));

  const overallTotal = overallSentimentData.reduce((sum, item) => sum + item.value, 0);
  const categoryTotal = categorySentimentData.reduce((sum, item) => sum + item.value, 0);
  const textColor = chartTextColor(isDark);
  const mutedColor = chartMutedColor(isDark);
  const sentimentCategoryLabel = ui(CATEGORY_LABELS[rotatingSentimentCategory]);
  const sentimentCategoryBadgeClass = CATEGORY_BADGE_CLASS[rotatingSentimentCategory];

  return (
    <div className={`rounded-2xl border shadow-lg p-4 ${panelBaseClass(isDark)}`}>
      <div className="flex items-center gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
            <Activity size={13} className="text-white" />
          </div>
          <h3 className={`font-poppins text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>
            {t.sentimentDistribution}
          </h3>
        </div>
      </div>

      <div className="space-y-3">
        <div className={`rounded-xl border p-3 ${isDark ? 'border-slate-700 bg-slate-900/30' : 'border-gray-100 bg-gray-50/70'}`}>
          <div className="flex items-center justify-between text-[11px] mb-2">
            <span className={`font-semibold ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>{ui("Overall")}</span>
            <span className={`px-2 py-0.5 rounded-full ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-gray-100 text-gray-700'}`}>
              {t.allCategories}
            </span>
          </div>

          {overallLoading ? <div className="grid min-h-44 place-items-center"><LoadingIndicator label={t.loading} /></div> : overallError ? <p role="alert">{t.fetchFailed}</p> : <>
          <DonutChart segments={overallSentimentData} isDark={isDark} />

          <div className="space-y-2">
            {overallSentimentData.map((item) => {
              const percentage = overallTotal > 0 ? Math.round((item.value / overallTotal) * 100) : 0;
              return (
                <div key={`overall-row-${item.type}`} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: item.color }} />
                    <span className="text-xs flex-1 truncate" style={{ color: textColor }}>{item.name}</span>
                    <span className="text-xs font-semibold" style={{ color: item.color }}>
                      {item.value} ({percentage}%)
                    </span>
                  </div>
                  <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-slate-700' : 'bg-gray-100'}`}>
                    <div className="h-full rounded-full transition-[width] duration-300 ease-out" style={{ width: `${percentage}%`, background: item.color }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-[11px] pt-2">
            <span style={{ color: mutedColor }}>{ui("Total analyzed (Overall)")}</span>
            <span className="font-semibold" style={{ color: textColor }}>{overallTotal}</span>
          </div>
          </>}
        </div>

        <div className={`rounded-xl border p-3 ${isDark ? 'border-slate-700 bg-slate-900/30' : 'border-gray-100 bg-gray-50/70'}`}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className={`text-[11px] font-semibold ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>{ui("Per Category")}</span>
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${sentimentCategoryBadgeClass}`}>
                {sentimentCategoryLabel}
              </span>
            </div>

            {selectedCategory === 'all' && (
              <button
                type="button"
                onClick={handleNextSentimentCategory}
                className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-colors ${isDark ? 'bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30' : 'bg-cyan-50 text-cyan-700 hover:bg-cyan-100'}`}
              >
                {t.next}
              </button>
            )}
          </div>

          {categoryLoading ? <div className="grid min-h-44 place-items-center"><LoadingIndicator label={t.loading} /></div> : categoryError ? <p role="alert">{t.fetchFailed}</p> : <>
          <DonutChart segments={categorySentimentData} isDark={isDark} />

          <div className="space-y-2">
            {categorySentimentData.map((item) => {
              const percentage = categoryTotal > 0 ? Math.round((item.value / categoryTotal) * 100) : 0;
              return (
                <div key={`category-row-${item.type}`} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: item.color }} />
                    <span className="text-xs flex-1 truncate" style={{ color: textColor }}>{item.name}</span>
                    <span className="text-xs font-semibold" style={{ color: item.color }}>
                      {item.value} ({percentage}%)
                    </span>
                  </div>
                  <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-slate-700' : 'bg-gray-100'}`}>
                    <div className="h-full rounded-full transition-[width] duration-300 ease-out" style={{ width: `${percentage}%`, background: item.color }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-[11px] pt-2">
            <span style={{ color: mutedColor }}>{ui("Total analyzed (")}{sentimentCategoryLabel})</span>
            <span className="font-semibold" style={{ color: textColor }}>{categoryTotal}</span>
          </div>
          </>}

          {selectedCategory === 'all' && (
            <div className="mt-2">
              <div className={`h-1 rounded-full overflow-hidden ${isDark ? 'bg-slate-1000' : 'bg-gray-100'}`}>
                <motion.div
                  key={sentimentCategoryLabel}
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: SENTIMENT_ROTATE_MS / 1000, ease: 'linear' }}
                  className="h-full rounded-full bg-cyan-500"
                />
              </div>
              <p className="text-[11px] mt-1" style={{ color: mutedColor }}>{ui("Auto-rotate every")} {Math.round(SENTIMENT_ROTATE_MS / 1000)}s
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
