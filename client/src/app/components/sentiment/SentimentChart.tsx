import { useUiText } from '../../i18n/uiText';
import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { InsightMark } from '../ui/InsightMark';
import { useApp } from '../../contexts/AppContext';
import { CATEGORY_BADGE_CLASS, CATEGORIES, CATEGORY_LABELS } from '../../constants';
import { useStatsOverview, type StatsOverview } from '../../hooks/useStats';
import type { NewsCategoryFilter } from '../../types/article';
import type { SentimentDistributionItem } from '../../types/sentiment';
import { SentimentExplorer } from './SentimentExplorer';
import { SentimentReasons } from './SentimentReasons';
import { useReasonFocus } from './useReasonFocus';
import { panelBaseClass, chartTextColor, chartMutedColor } from './shared';
import { LoadingIndicator } from '../ui/ContentSkeleton';
import { RollingNumber } from '../ui/RollingNumber';
import { SENTIMENT_COLOR } from '../ui/chartTheme';
import { LoadError } from '../ui/ErrorNote';

const toDistribution = (overview: StatsOverview | undefined): SentimentDistributionItem[] =>
  (['positive', 'neutral', 'negative'] as const).map((type) => ({
    type,
    count: overview?.sentiments[type] ?? 0,
  }));


const SENTIMENT_ROTATE_MS = 10000;
// Same as the AutoPages arrows under Live View and Reporting authors.
const arrowClass = 'grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-800 pointer-coarse:h-11 pointer-coarse:w-11 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100';

export function SentimentChart() {
  const ui = useUiText();
  const reducedMotion = useReducedMotion();
  const { t, isDark, selectedCategory, selectedSources = [], selectedCategories = [] } = useApp();
  const [sentimentCategoryIndex, setSentimentCategoryIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  // Rotation keeps going with the reasons open (they stay open from one category to the
  // next); hovering or focusing the panel pauses it.
  const paused = hovered || focused;
  const rotationCategories = selectedCategories.length > 1 ? selectedCategories : CATEGORIES;
  const rotationCount = rotationCategories.length;

  const rotatingSentimentCategory: NewsCategoryFilter = selectedCategory === 'all'
    ? rotationCategories[sentimentCategoryIndex % rotationCount]
    : selectedCategory;
  const [overallReasonFocus, pickOverallReason] = useReasonFocus(selectedCategory);
  const [categoryReasonFocus, pickCategoryReason] = useReasonFocus(rotatingSentimentCategory);

  // SQL-side aggregates via /api/stats/overview (no full-dataset download).
  const { data: overallOverview, isPending: overallLoading, isError: overallError } = useStatsOverview(selectedCategory);
  // Every split already comes with the overall request. Reuse it so rotation
  // keeps the donut mounted instead of flashing a loader for each category.
  const categoryOverview = overallOverview?.byCategory?.find((row) => row.topic === CATEGORY_LABELS[rotatingSentimentCategory]);
  const categoryLoading = overallLoading;
  const categoryError = overallError || Boolean(overallOverview && !Array.isArray(overallOverview.byCategory));
  const overallSentimentDistribution = toDistribution(overallOverview);
  const categorySentimentDistribution = (['positive', 'neutral', 'negative'] as const).map((type) => ({type, count: categoryOverview?.sentiments[type] ?? 0}));

  // Rotation control: auto-cycle when viewing "all", otherwise lock to the selection.
  useEffect(() => {
    if (selectedCategory === 'all') {
      if (paused || reducedMotion) return;
      const id = window.setInterval(
        () => setSentimentCategoryIndex((prev) => (prev + 1) % rotationCount),
        SENTIMENT_ROTATE_MS
      );
      return () => window.clearInterval(id);
    }
    const categoryIndex = CATEGORIES.indexOf(selectedCategory);
    if (categoryIndex >= 0) setSentimentCategoryIndex(categoryIndex);
  }, [selectedCategory, rotationCount, paused, sentimentCategoryIndex, reducedMotion]);

  // The reasons dropdown keeps its open or closed state from one category to the next.
  const handleNextSentimentCategory = () => {
    setSentimentCategoryIndex((prev) => (prev + 1) % rotationCount);
  };

  const overallSentimentData = overallSentimentDistribution.map((item) => ({
    name: t[item.type],
    value: item.count,
    color: SENTIMENT_COLOR[item.type],
    type: item.type,
  }));

  const categorySentimentData = categorySentimentDistribution.map((item) => ({
    name: t[item.type],
    value: item.count,
    color: SENTIMENT_COLOR[item.type],
    type: item.type,
  }));

  const overallTotal = overallSentimentData.reduce((sum, item) => sum + item.value, 0);
  const categoryTotal = categorySentimentData.reduce((sum, item) => sum + item.value, 0);
  const textColor = chartTextColor(isDark);
  const mutedColor = chartMutedColor(isDark);
  const sentimentCategoryLabel = ui(CATEGORY_LABELS[rotatingSentimentCategory]);
  const sentimentCategoryBadgeClass = CATEGORY_BADGE_CLASS[rotatingSentimentCategory];

  return (
    <div className={`rounded-2xl border p-4 ${panelBaseClass()}`}>
      <div className="flex items-center gap-2 mb-3">
        <div className="flex items-center gap-2">
          <InsightMark kind="sentiment" />
          <h3 className={`font-poppins text-sm font-semibold text-slate-800 dark:text-slate-200`}>
            {t.sentimentDistribution}
          </h3>
        </div>
      </div>

      <div className="space-y-3">
        {selectedSources.length > 0 && <p className="text-xs opacity-70 break-words">{selectedSources.map(source => ({ bbc: 'BBC', cnn: 'CNN', aljazeera: 'Al Jazeera', yahoo_tw: 'Yahoo Taiwan' }[source] || source)).join(' · ')}</p>}
        <div className={`rounded-xl p-3 bg-slate-50 dark:bg-slate-800/60`}>
          <div className="flex items-center justify-between text-xs mb-2">
            <span className={`font-semibold text-slate-700 dark:text-slate-300`}>{selectedCategory === 'all' ? ui("Overall") : ui(CATEGORY_LABELS[selectedCategory])}</span>
            <span className={`px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300`}>
              {selectedCategories.length > 1 ? selectedCategories.map(cat => ui(CATEGORY_LABELS[cat])).join(' · ') : selectedCategory === 'all' ? t.allCategories : ui(CATEGORY_LABELS[selectedCategory])}
            </span>
          </div>

          {overallLoading ? <div className="grid min-h-44 place-items-center"><LoadingIndicator label={t.loading} /></div> : overallError ? <LoadError message={t.fetchFailed} /> : <>
          <SentimentExplorer counts={overallOverview?.sentiments ?? {positive:0,neutral:0,negative:0}} sources={overallOverview?.bySource} scopeKey={selectedCategory} selection={overallReasonFocus} onPick={pickOverallReason} />
          <div className="flex items-center justify-between text-xs pt-2">
            <span style={{ color: mutedColor }}>{selectedCategory === 'all' ? ui("Articles analysed") : `${ui("Articles analysed (")}${ui(CATEGORY_LABELS[selectedCategory])})`}</span>
            <span className="font-semibold" style={{ color: textColor }}><RollingNumber value={overallTotal} /></span>
          </div>
          <SentimentReasons evidence={overallOverview?.evidence} focus={overallReasonFocus} onPick={pickOverallReason} />
          </>}
        </div>

        {selectedCategory === 'all' && <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }} className={`rounded-xl p-3 bg-slate-50 dark:bg-slate-800/60`}>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className={`text-xs font-semibold text-slate-700 dark:text-slate-300`}>{ui("Per Category")}</span>
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${sentimentCategoryBadgeClass}`}>
                {sentimentCategoryLabel}
              </span>
            </div>
          </div>

          {categoryLoading ? <div className="grid min-h-44 place-items-center"><LoadingIndicator label={t.loading} /></div> : categoryError ? <LoadError message={t.fetchFailed} /> : <>
          <SentimentExplorer counts={categoryOverview?.sentiments ?? {positive:0,neutral:0,negative:0}} sources={categoryOverview?.bySource} scopeKey={rotatingSentimentCategory} selection={categoryReasonFocus} onPick={pickCategoryReason} />
          <div className="flex items-center justify-between text-xs pt-2">
            <span style={{ color: mutedColor }}>{ui("Articles analysed (")}{sentimentCategoryLabel})</span>
            <span className="font-semibold" style={{ color: textColor }}><RollingNumber value={categoryTotal} /></span>
          </div>
          <SentimentReasons evidence={categoryOverview?.evidence} scopeKey={rotatingSentimentCategory} focus={categoryReasonFocus} onPick={pickCategoryReason} />
          </>}

          {/* Arrows either side of the dots; like the timer, they wrap. */}
          {selectedCategory === 'all' && <div className="mt-3 flex items-center justify-center gap-1">
          <button type="button" aria-label={ui('Previous category')}
            onPointerDown={event => { if (event.pointerType === 'mouse') event.preventDefault(); }}
            onClick={() => setSentimentCategoryIndex((prev) => (prev + rotationCount - 1) % rotationCount)}
            className={arrowClass}><ChevronLeft size={16} aria-hidden="true" /></button>
          {/* No gap and 24px-wide dots so all eight fit on one row between the arrows,
              even in the narrowest rail with the larger touch arrows. */}
          <div className="flex min-w-0 flex-wrap justify-center" role="group" aria-label={ui('Per Category')}>
            {rotationCategories.map((category, index) => <button key={category} type="button"
              aria-label={ui(CATEGORY_LABELS[category])} title={ui(CATEGORY_LABELS[category])}
              aria-current={rotatingSentimentCategory === category ? 'true' : undefined}
              onPointerDown={event => { if (event.pointerType === 'mouse') event.preventDefault(); }}
              onClick={() => setSentimentCategoryIndex(index)}
              className="group grid h-9 w-6 place-items-center rounded-full text-slate-500 focus-visible:outline-2 focus-visible:outline-current dark:text-slate-400">
              {/* Grey, not the category colour: the selected dot is wider and darker. */}
              <span className={`h-2.5 rounded-full transition-[background-color,width] duration-150 motion-reduce:transition-none ${rotatingSentimentCategory === category ? 'w-5 bg-current' : 'w-2.5 bg-slate-300 group-hover:bg-current dark:bg-slate-600'}`} />
            </button>)}
          </div>
          <button type="button" aria-label={ui('Next category')}
            onPointerDown={event => { if (event.pointerType === 'mouse') event.preventDefault(); }}
            onClick={handleNextSentimentCategory}
            className={arrowClass}><ChevronRight size={16} aria-hidden="true" /></button>
          </div>}
          {/* The track always keeps its space so pausing on hover doesn't
              shrink the panel and push the pointer back out of it. */}
          {selectedCategory === 'all' && !reducedMotion && (
            <div className="mt-2" aria-hidden={paused || undefined}>
              <div className={`h-1 rounded-full overflow-hidden transition-opacity duration-150 ${paused ? 'opacity-0' : ''} bg-slate-100 dark:bg-slate-800`}>
                {!paused && <motion.div
                  key={sentimentCategoryLabel}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: SENTIMENT_ROTATE_MS / 1000, ease: 'linear' }}
                  className="h-full w-full origin-left rounded-full bg-[var(--brand)]"
                />}
              </div>

            </div>
          )}
        </div>}
      </div>
    </div>
  );
}
