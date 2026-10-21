import { TrendingUp } from 'lucide-react';
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
  const { data: trendingKeywords = [] } = useTrendingStats(10, selectedCategory);

  const maxKeywordCount = Math.max(1, ...trendingKeywords.map((item) => item.count));
  const textColor = chartTextColor(isDark);
  const mutedColor = chartMutedColor(isDark);

  return (
    <div className={`rounded-2xl border shadow-lg p-4 ${panelBaseClass(isDark)}`}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center">
          <TrendingUp size={13} className="text-white" />
        </div>
        <h3
          className={`font-poppins text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-gray-800'}`}
        >
          {t.trendingTopics}
        </h3>
      </div>

      <div className="space-y-2">
        {trendingKeywords.length === 0 ? (
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>{t.noResults}</p>
        ) : (
          trendingKeywords.map((topic, i) => (
            <div key={topic.keyword} className="flex items-center gap-2">
              <span className="text-xs font-bold w-4" style={{ color: mutedColor }}>
                {i + 1}
              </span>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-medium" style={{ color: textColor }}>
                    {displayKeyword(topic.label || topic.keyword)}
                  </span>
                  <span className="text-xs" style={{ color: mutedColor }}>
                    {topic.count}
                  </span>
                </div>
                <div
                  className={`h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-slate-700' : 'bg-gray-100'}`}
                >
                  <div
                    className="h-full rounded-full transition-[width] duration-300 ease-out"
                    style={{
                      width: `${(topic.count / maxKeywordCount) * 100}%`,
                      background: 'var(--brand)',
                    }}
                  />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
