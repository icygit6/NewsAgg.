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

export function InsightsPage() {
  const { t, isDark, language } = useApp();
  const [params] = useSearchParams();
  const view = params.get('view') === 'sources' ? 'sources' : params.get('view') === 'research' ? 'research' : 'published';
  const zh = language === 'zhTW' || language === 'zhCN';
  // Full width: this route has no right rail, and the former 72rem cap left
  // a wide empty band beside the panels on desktop screens.
  return <div className="w-full px-4 py-6 md:px-6 xl:px-10">
    <h1 className={`font-poppins text-2xl font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{t.insights}</h1>
    <p className={`mt-1 mb-5 max-w-3xl text-sm leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
      {t.insightsNote}{' '}<Link to="/methodology" className="font-semibold text-blue-600 hover:underline">{t.methodologyTitle} →</Link>
    </p>
    <nav className={`${segment.track} mb-5 flex-wrap`} aria-label={zh ? '洞察檢視' : 'Insights views'}>
      {[
        ['published', zh ? '新聞資料概覽' : 'Published news'],
        ['research', zh ? '研究與測試' : 'Research & tests'],
        ['sources', zh ? '採集來源' : 'Collection sources'],
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
  if (overviewQuery.isError || latestQuery.isError) return <div role="alert" className="rounded-2xl border border-red-300 p-5"><p>{t.fetchFailed}</p><button type="button" className="mt-3 min-h-11 rounded-xl border px-4" onClick={() => { void overviewQuery.refetch(); void latestQuery.refetch(); }}>{ui('Try again')}</button></div>;

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


