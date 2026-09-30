import { useUiText } from '../i18n/uiText';
import { useApp } from '../contexts/AppContext';
import { CATEGORY_LABELS } from '../constants';
import { useStatsOverview } from '../hooks/useStats';
import { useLatestArticles } from '../hooks/useArticles';
import type { DatasetSnapshot } from '../types/api';
import { SentimentChart } from '../components/sentiment/SentimentChart';
import { LiveView } from '../components/sentiment/LiveView';
import { TrendingKeywords } from '../components/sentiment/TrendingKeywords';
import { DatasetStats } from '../components/sentiment/DatasetStats';
import { BusinessInsights } from '../components/widgets/BusinessInsights';
import { PanelSkeleton } from '../components/ui/ContentSkeleton';

export function InsightsPage() {
  const ui = useUiText();
  const { t, isDark, selectedCategory } = useApp();
  const { data: overview, isLoading: overviewLoading } = useStatsOverview(selectedCategory);
  const { data: latest, isLoading: latestLoading } = useLatestArticles({ limit: 8, category: selectedCategory });

  const categoryLabel =
    selectedCategory === 'all' ? t.allCategories : ui(CATEGORY_LABELS[selectedCategory]);

  const snapshot: DatasetSnapshot = {
    status: 'ok',
    totalResults: overview?.total ?? 0,
    articleCount: overview?.total ?? 0,
    scrapedAt: overview?.scrapedAt ?? null,
    categories: (overview?.categories ?? []) as DatasetSnapshot['categories'],
    aiModels: overview?.aiModels ?? {},
    nlpModels: overview?.nlpModels,
    sourceCount: overview?.sourceCount ?? 0,
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className={`font-poppins text-2xl font-bold mb-6 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
        {t.insights}
      </h1>
      <div className="space-y-4">
        {overviewLoading || latestLoading ? <PanelSkeleton /> : (
          <>
            <BusinessInsights />
            <SentimentChart />
            <LiveView articles={latest?.articles ?? []} categoryLabel={categoryLabel} />
            <TrendingKeywords />
            <DatasetStats
              articleCount={overview?.total ?? 0}
              keywordCount={overview?.keywordCount ?? 0}
              snapshot={snapshot}
              categoryLabel={categoryLabel}
            />
          </>
        )}
      </div>
    </div>
  );
}
