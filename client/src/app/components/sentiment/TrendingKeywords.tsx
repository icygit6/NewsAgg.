import { TrendingPanel } from '../ui/ContentSkeleton';
import { AutoPages } from '../ui/AutoPages';
import { InsightMark } from '../ui/InsightMark';
import { useApp } from '../../contexts/AppContext';
import { useTrendingStats } from '../../hooks/useStats';
import { panelBaseClass, chartTextColor, chartMutedColor } from './shared';

// Keywords are stored lower-cased; restore conventional casing for Latin
// words ("Trump", "AI") without touching Chinese or mixed-case labels.
const ACRONYMS = new Set(['ai', 'us', 'uk', 'eu', 'un', 'who', 'nato', 'nba', 'mlb', 'nfl', 'fbi', 'cia', 'gdp', 'tsmc', 'ev', 'ceo']);
const displayKeyword = (word: string) =>
  /^[a-z][a-z\s'-]*$/.test(word)
    ? word.split(' ').map((part) => (ACRONYMS.has(part) ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1))).join(' ')
    : word;

export function TrendingKeywords() {
  const { t, isDark, selectedCategory } = useApp();

  // SQL-side keyword frequencies via /api/stats/trending.
  const { data: trendingKeywords = [], isLoading } = useTrendingStats(50, selectedCategory);

  const maxKeywordCount = Math.max(1, ...trendingKeywords.map((item) => item.count));
  const textColor = chartTextColor(isDark);
  const mutedColor = chartMutedColor(isDark);

  if (isLoading) return <div role="status" aria-busy="true" aria-label={t.loading}><TrendingPanel /></div>;

  return (
    <div className={`rounded-2xl border p-4 ${panelBaseClass(isDark)}`}>
      <div className="flex items-center gap-2 mb-3">
        <InsightMark kind="trending" />
        <h3
          className={`font-poppins text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-gray-800'}`}
        >
          {t.trendingTopics}
        </h3>
      </div>

        {trendingKeywords.length === 0 ? (
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>{t.noResults}</p>
        ) : (
          <AutoPages label={t.trendingTopics} scopeKey={selectedCategory}
            pageClassName="divide-y divide-slate-100 dark:divide-slate-800"
            items={trendingKeywords.map((topic, i) => (
            <div key={topic.keyword} className="flex min-h-10 items-center gap-3 py-2">
              <span className="text-xs tabular-nums w-5 shrink-0 text-right" style={{ color: mutedColor }}>
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 break-words text-sm font-medium" style={{ color: textColor }}>
                {displayKeyword(topic.label || topic.keyword)}
              </span>
              <div className="w-20 shrink-0 text-right">
                <span className="text-xs tabular-nums" style={{ color: mutedColor }}>{topic.count.toLocaleString()}</span>
                <div className={`mt-1 h-1 overflow-hidden rounded-full ${isDark ? 'bg-slate-700' : 'bg-gray-100'}`}>
                  <div className="h-full origin-left rounded-full transition-transform duration-300 motion-reduce:transition-none" style={{ transform: `scaleX(${topic.count / maxKeywordCount})`, background: 'var(--brand)' }} />
                </div>
              </div>
            </div>
          ))} />
        )}
    </div>
  );
}
