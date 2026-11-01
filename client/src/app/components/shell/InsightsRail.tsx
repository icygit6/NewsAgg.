import { useUiText } from '../../i18n/uiText';
import { useApp } from '../../contexts/AppContext';
import { CATEGORY_LABELS } from '../../constants';
import { useStatsOverview } from '../../hooks/useStats';
import { useLatestArticles } from '../../hooks/useArticles';
import type { DatasetSnapshot } from '../../types/api';
import { SentimentChart } from '../sentiment/SentimentChart';
import { LiveView } from '../sentiment/LiveView';
import { TrendingKeywords } from '../sentiment/TrendingKeywords';
import { DatasetStats } from '../sentiment/DatasetStats';
import { BusinessInsights } from '../widgets/BusinessInsights';
import { ReportingAuthors } from '../sentiment/ReportingAuthors';
import { RailSkeleton } from '../ui/ContentSkeleton';

/** Compact analytics for the right rail's Insights tab — the full set from
 * the old SentimentPanel: sentiment donut, live view, trending keywords,
 * live engagement and dataset stats. Stats come from the SQL-side /api/stats
 * endpoints; article lists from the cheap paginated endpoint (never the
 * legacy full-dataset store). */
export function InsightsRail() {
  const ui = useUiText();
  const { t, selectedCategory, selectedCategories = [] } = useApp();
  const { data: overview, isLoading: overviewLoading } = useStatsOverview(selectedCategory);
  const { data: latest, isLoading: latestLoading } = useLatestArticles({ limit: 30, category: selectedCategory });

  const categoryLabel =
    selectedCategories.length > 1 ? selectedCategories.map(cat => ui(CATEGORY_LABELS[cat])).join(' · ') : selectedCategory === 'all' ? t.allCategories : ui(CATEGORY_LABELS[selectedCategory]);

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

  if (overviewLoading || latestLoading) return <RailSkeleton dual={selectedCategory === 'all'} />;

  return (
    <div className="insights-reveal space-y-4 w-full">
      <BusinessInsights />
      <SentimentChart />
      <LiveView articles={latest?.articles ?? []} categoryLabel={categoryLabel} />
      <TrendingKeywords />
      <ReportingAuthors authors={overview?.reportingAuthors ?? []} total={overview?.total ?? 0} />
      <DatasetStats
        articleCount={overview?.total ?? 0}
        keywordCount={overview?.keywordCount ?? 0}
        snapshot={snapshot}
        categoryLabel={categoryLabel}
      />
    </div>
  );
}
