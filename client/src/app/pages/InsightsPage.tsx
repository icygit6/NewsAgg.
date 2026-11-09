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
import { useIsMobile } from '../components/ui/use-mobile';

/** Tailwind's `lg`, where the two-column layout starts. */
const LG_BREAKPOINT = 1024;
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
      {t.insightsNote}{' '}<Link to="/methodology" className="font-semibold text-blue-600 hover:text-blue-700 dark:hover:text-blue-300">{t.methodologyTitle} →</Link>
    </p>
    {/* One static line at every width: phones show the short names in equal columns. */}
    <nav className={`${segment.track} mb-5 w-full sm:w-auto`} aria-label={ui('Insights views')}>
      {[
        ['published', ui('Published news'), ui('News')],
        ['research', ui('Research & tests'), ui('Research')],
        ['sources', ui('Collection sources'), ui('Sources')],
      ].map(([key, title, short]) => <Link key={key} to={key === 'published' ? '/insights' : `/insights?view=${key}`} aria-label={title} aria-current={view === key ? 'page' : undefined} className={`inline-flex min-h-10 flex-1 items-center justify-center whitespace-nowrap text-center sm:flex-none ${view === key ? segment.active : segment.item}`}><span className="sm:hidden">{short}</span><span className="hidden sm:inline">{title}</span></Link>)}
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
  const narrow = useIsMobile(LG_BREAKPOINT);
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

  const stats = (part: 'stats' | 'models') => <DatasetStats part={part}
    articleCount={overview?.total ?? 0}
    keywordCount={overview?.keywordCount ?? 0}
    snapshot={snapshot}
    categoryLabel={categoryLabel}
  />;

  return (
    <>
      {overviewLoading || latestLoading ? <PanelSkeleton /> : narrow ? (
        // One column below lg: the dataset numbers first, then the desktop
        // right rail's order (sentiment, the live feed, keywords and
        // bylines), with the pipeline last.
        <div className="insights-reveal space-y-4">
          {stats('stats')}
          <BusinessInsights />
          <SentimentByCategory part="overview" />
          <SentimentByCategory part="ranking" />
          <LiveView articles={latest?.articles ?? []} categoryLabel={categoryLabel} expanded />
          <TrendingKeywords />
          <ReportingAuthors authors={overview?.reportingAuthors ?? []} total={overview?.total ?? 0} />
          {stats('models')}
        </div>
      ) : (
        // A summary strip, then two independent columns: sentiment, its
        // reasons, the live feed and the pipeline on the left; the category
        // comparison, keywords and bylines on the right. Their heights are
        // close, so both columns end together.
        <div className="insights-reveal space-y-4">
          <BusinessInsights />
          {stats('stats')}
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <div className="min-w-0 space-y-4">
              <SentimentByCategory part="overview" />
              <LiveView articles={latest?.articles ?? []} categoryLabel={categoryLabel} expanded />
              {stats('models')}
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


