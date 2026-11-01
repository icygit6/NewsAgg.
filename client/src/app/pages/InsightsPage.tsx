import { Link, useSearchParams } from 'react-router';
import { useUiText } from '../i18n/uiText';
import { useApp } from '../contexts/AppContext';
import { CATEGORY_LABELS } from '../constants';
import { useStatsOverview } from '../hooks/useStats';
import { useLatestArticles } from '../hooks/useArticles';
import { ReportingAuthors } from '../components/sentiment/ReportingAuthors';
import type { DatasetSnapshot } from '../types/api';
import { SentimentByCategory } from '../components/sentiment/SentimentByCategory';
import { LiveView } from '../components/sentiment/LiveView';
import { TrendingKeywords } from '../components/sentiment/TrendingKeywords';
import { DatasetStats } from '../components/sentiment/DatasetStats';
import { BusinessInsights } from '../components/widgets/BusinessInsights';
import { PanelSkeleton } from '../components/ui/ContentSkeleton';
import { EvaluationPanel } from '../components/insights/EvaluationPanel';
import { SourcesPage } from './SourcesPage';
import { segment } from '../components/ui/styles';
import { FeedState } from '../components/feed/FeedState';
import { feedStateButton } from '../components/feed/feedStateButton';

export function InsightsPage() {
  const ui = useUiText();
  const { t } = useApp();
  const [params] = useSearchParams();
  const view = params.get('view') === 'sources' ? 'sources' : params.get('view') === 'research' ? 'research' : 'published';
  // Full width: this route has no right rail, and the former 72rem cap left
  // a wide empty band beside the panels on desktop screens.
  return <div className="w-full px-4 py-6 md:px-6 xl:px-10">
    <h1 className={`font-poppins text-2xl font-bold text-slate-900 dark:text-slate-100`}>{t.insights}</h1>
    <p className={`mt-1 mb-5 max-w-3xl text-sm leading-relaxed text-slate-500 dark:text-slate-400`}>
      {t.insightsNote}{' '}<Link to="/methodology" className="font-semibold text-blue-600 hover:underline">{t.methodologyTitle} →</Link>
    </p>
    <nav className={`${segment.track} mb-5 flex-wrap`} aria-label={ui('Insights views')}>
      {[
        ['published', ui('Published news')],
        ['research', ui('Research & tests')],
        ['sources', ui('Collection sources')],
      ].map(([key, title]) => <Link key={key} to={key === 'published' ? '/insights' : `/insights?view=${key}`} aria-current={view === key ? 'page' : undefined} className={`inline-flex min-h-10 items-center ${view === key ? segment.active : segment.item}`}>{title}</Link>)}
    </nav>
    {view === 'research' ? <EvaluationPanel /> : view === 'sources' ? <SourcesPage embedded /> : <LiveInsights />}
  </div>;
}

function LiveInsights() {
  const ui = useUiText();
  const { t, selectedCategory, selectedCategories = [] } = useApp();
  const overviewQuery = useStatsOverview(selectedCategory);
  const latestQuery = useLatestArticles({ limit: 30, category: selectedCategory });
  const { data: overview, isLoading: overviewLoading } = overviewQuery;
  const { data: latest, isLoading: latestLoading } = latestQuery;
  if (overviewQuery.isError || latestQuery.isError) return <FeedState tone="error" title={t.errorTitle} body={t.fetchFailed} action={<button type="button" className={feedStateButton} onClick={() => { void overviewQuery.refetch(); void latestQuery.refetch(); }}>{ui('Try again')}</button>} />;

  const categoryLabel =
    selectedCategories.length > 1 ? selectedCategories.map(category => ui(CATEGORY_LABELS[category])).join(' · ') : selectedCategory === 'all' ? t.allCategories : ui(CATEGORY_LABELS[selectedCategory]);

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
    <>
      {overviewLoading || latestLoading ? <PanelSkeleton /> : (
        // A summary strip, then two independent columns: sentiment, its
        // reasons, the live feed and the pipeline on the left; the category
        // comparison, keywords and bylines on the right. Their heights are
        // close, so both columns end together.
        <div className="insights-reveal space-y-4">
          <BusinessInsights />
          <DatasetStats part="stats"
            articleCount={overview?.total ?? 0}
            keywordCount={overview?.keywordCount ?? 0}
            snapshot={snapshot}
            categoryLabel={categoryLabel}
          />
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <div className="min-w-0 space-y-4">
              <SentimentByCategory part="overview" />
              <LiveView articles={latest?.articles ?? []} categoryLabel={categoryLabel} expanded />
              <DatasetStats part="models"
                articleCount={overview?.total ?? 0}
                keywordCount={overview?.keywordCount ?? 0}
                snapshot={snapshot}
                categoryLabel={categoryLabel}
              />
            </div>
            <div className="min-w-0 space-y-4">
              <SentimentByCategory part="ranking" />
              <TrendingKeywords />
              <ReportingAuthors authors={overview?.reportingAuthors ?? []} total={overview?.total ?? 0} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}


