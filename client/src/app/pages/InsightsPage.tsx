import { Link, useSearchParams } from 'react-router';
import { useUiText } from '../i18n/uiText';
import { useApp } from '../contexts/AppContext';
import { CATEGORY_LABELS } from '../constants';
import { useStatsOverview } from '../hooks/useStats';
import { useLatestArticles } from '../hooks/useArticles';
import type { DatasetSnapshot } from '../types/api';
import { SentimentByCategory } from '../components/sentiment/SentimentByCategory';
import { LiveView } from '../components/sentiment/LiveView';
import { TrendingKeywords } from '../components/sentiment/TrendingKeywords';
import { DatasetStats } from '../components/sentiment/DatasetStats';
import { BusinessInsights } from '../components/widgets/BusinessInsights';
import { PanelSkeleton } from '../components/ui/ContentSkeleton';
import { EvaluationPanel } from '../components/insights/EvaluationPanel';

export function InsightsPage() {
  const { t, isDark, language } = useApp();
  const [params] = useSearchParams();
  const research = params.get('view') === 'research';
  const zh = language === 'zhTW' || language === 'zhCN';
  return <div className="max-w-6xl mx-auto px-4 py-6">
    <h1 className={`font-poppins text-2xl font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{t.insights}</h1>
    <p className={`mt-1 mb-5 max-w-3xl text-sm leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
      {t.insightsNote}{' '}<Link to="/methodology" className="font-semibold text-blue-600 hover:underline">{t.methodologyTitle} →</Link>
    </p>
    <nav className="flex flex-wrap gap-2 mb-5" aria-label={zh ? '洞察檢視' : 'Insights views'}>
      {[[false, zh ? '新聞資料概覽' : 'Published news'], [true, zh ? '研究、評估與測試' : 'Research, evaluation & tests']].map(([active, title]) => <Link key={String(active)} to={active ? '/insights?view=research' : '/insights'} aria-current={research === active ? 'page' : undefined} className={`min-h-11 px-4 py-3 rounded-xl text-sm font-semibold ${research === active ? 'bg-blue-600 text-white' : isDark ? 'bg-slate-800 text-slate-200' : 'bg-white border border-slate-200 text-slate-700'}`}>{title}</Link>)}
    </nav>
    {research ? <EvaluationPanel /> : <LiveInsights />}
  </div>;
}

function LiveInsights() {
  const ui = useUiText();
  const { t, selectedCategory } = useApp();
  const overviewQuery = useStatsOverview(selectedCategory);
  const latestQuery = useLatestArticles({ limit: 8, category: selectedCategory });
  const { data: overview, isLoading: overviewLoading } = overviewQuery;
  const { data: latest, isLoading: latestLoading } = latestQuery;
  if (overviewQuery.isError || latestQuery.isError) return <div role="alert" className="rounded-2xl border border-red-300 p-5"><p>{t.fetchFailed}</p><button type="button" className="mt-3 min-h-11 rounded-xl border px-4" onClick={() => { void overviewQuery.refetch(); void latestQuery.refetch(); }}>{ui('Try again')}</button></div>;

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
    <>
      {overviewLoading || latestLoading ? <PanelSkeleton /> : (
        // Two columns on wide screens; the former single 42rem column left
        // most of a desktop viewport empty.
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <div className="min-w-0 lg:col-span-2">
            <BusinessInsights />
          </div>
          <div className="min-w-0 space-y-4">
            <SentimentByCategory />
            <TrendingKeywords />
          </div>
          <div className="min-w-0 space-y-4">
            <LiveView articles={latest?.articles ?? []} categoryLabel={categoryLabel} />
            <DatasetStats
              articleCount={overview?.total ?? 0}
              keywordCount={overview?.keywordCount ?? 0}
              snapshot={snapshot}
              categoryLabel={categoryLabel}
            />
          </div>
        </div>
      )}
    </>
  );
}
