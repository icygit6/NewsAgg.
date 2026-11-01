import { useUiText } from '../i18n/uiText';
import { ArticleSkeleton } from '../components/ui/ContentSkeleton';
import { useEffect, useMemo, useState } from 'react';
import { Footer } from '../components/shell/Footer';
import { Link, useNavigate, useParams } from 'react-router';
import { motion } from 'motion/react';
import { ArrowLeft } from 'lucide-react';
import { BrandLogo } from '../components/ui/BrandLogo';
import { useApp } from '../contexts/AppContext';
import { POSTS_ENABLED, TOPIC_TO_CATEGORY } from '../constants';
import { ArticleHeader } from '../components/article/ArticleHeader';
import { ArticleBody } from '../components/article/ArticleBody';
import { ArticleFooter } from '../components/article/ArticleFooter';
import { ArticleSidebar } from '../components/article/ArticleSidebar';
import { ArticleChat } from '../components/article/ArticleChat';
import { ArticleQuotes } from '../components/article/ArticleQuotes';
import { LanguageSwitcher } from '../components/ui/LanguageSwitcher';
import { useTranslate } from '../hooks/useTranslate';
import { useArticle } from '../hooks/useArticle';
import { useStatsOverview, useTrendingStats } from '../hooks/useStats';
import { useLatestArticles } from '../hooks/useArticles';
import { mutedTextClass, panelBaseClass } from '../components/article/helpers';
import { buildLiveEngagement, getArticleId } from '../services/newsAPI';
import type { NewsArticle, NewsCategoryFilter } from '../types/article';
import type { SentimentDistributionItem } from '../types/sentiment';
import { DEFAULT_TITLE, SeoMetadata } from '../components/SeoMetadata';
import { useScrollFade, fadeMask } from '../hooks/useScrollFade';

export function ArticlePage() {
  const ui = useUiText();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, isDark } = useApp();

  // ── Article via React Query (GET /api/articles/:id, legacy-store fallback) ─
  const { data, isLoading: loading, isError } = useArticle(id);
  const article: NewsArticle | null = data ?? null;
  const readingFade = useScrollFade<HTMLDivElement>(article?.id);
  const analysisFade = useScrollFade<HTMLElement>(article?.id);
  useEffect(() => {
    document.getElementById('article-reading-scroll')?.scrollTo({ top: 0 });
    document.getElementById('article-analysis-scroll')?.scrollTo({ top: 0 });
  }, [article?.id]);
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)');
    const resetScrollOwners = () => {
      // A portrait/tablet resize must not leave the now-hidden outer scroll
      // offset stranded beneath the new independently scrolling columns.
      document.getElementById('main-scroll')?.scrollTo({ top: 0 });
      document.getElementById('article-reading-scroll')?.scrollTo({ top: 0 });
      document.getElementById('article-analysis-scroll')?.scrollTo({ top: 0 });
    };
    desktop.addEventListener('change', resetScrollOwners);
    return () => desktop.removeEventListener('change', resetScrollOwners);
  }, []);
  const error = !id
    ? 'Article reference is missing.'
    : isError || (!loading && !article)
      ? 'Article not found in the current dataset.'
      : null;
  // SeoMetadata titles a story once it loads; a missing one should say so in
  // the browser tab too, not keep the generic site title.
  const notFound = !loading && error !== null;
  const notFoundTitle = ui('Article not found');
  useEffect(() => {
    if (!notFound) return;
    document.title = `${notFoundTitle} · NewsAgg`;
    return () => { document.title = DEFAULT_TITLE; };
  }, [notFound, notFoundTitle]);

  const [tick, setTick] = useState(Date.now());

  const handleBackToHome = () => {
    const historyIndex = window.history.state?.idx ?? 0;
    if (historyIndex > 0) { navigate(-1); return; }
    navigate('/');
  };

  // ── Derive category once article is loaded ────────────────────────────────
  const articleCategory: NewsCategoryFilter = article ? TOPIC_TO_CATEGORY[article.topic] : 'all';

  // ── Sidebar data: the SAME data layer as the main page (stats endpoints +
  // cheap paginated articles, shared React Query cache) — no legacy store. ──
  const { data: overview } = useStatsOverview(articleCategory);
  const { data: trendingKeywords } = useTrendingStats(50, articleCategory);
  const { data: latestPage } = useLatestArticles({ limit: 30, category: articleCategory });

  const categoryArticles = useMemo(() => latestPage?.articles ?? [], [latestPage]);
  const categorySentimentDistribution = useMemo<SentimentDistributionItem[]>(
    () =>
      overview
        ? [
            { type: 'positive', count: overview.sentiments.positive },
            { type: 'neutral', count: overview.sentiments.neutral },
            { type: 'negative', count: overview.sentiments.negative },
          ]
        : [],
    [overview]
  );
  const categoryLiveEngagement = useMemo(
    () => buildLiveEngagement(categoryArticles, tick, 6),
    [categoryArticles, tick]
  );

  // ── Tick timer ────────────────────────────────────────────────────────────
  useEffect(() => {
    const id = window.setInterval(() => setTick(Date.now()), 12_000);
    return () => window.clearInterval(id);
  }, []);

  // ── Translate (cache-first via backend; no-op unless translateMode is on) ──
  const tr = useTranslate(article);

  const panelBase = panelBaseClass();
  const mutedText = mutedTextClass();

  if (loading) return <ArticleSkeleton label={t.loading} />;

  if (error || !article) {
    return (
      <div className="px-4 md:px-6 py-6 max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="mb-6">
          <button type="button" onClick={handleBackToHome} className={`-ml-2 inline-flex min-h-9 items-center gap-2 rounded-lg px-2 text-sm font-medium transition-colors ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 dark:text-blue-400 hover:text-blue-700'}`}>
            <ArrowLeft size={16} />{t.backToHome}
          </button>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`text-center py-20 rounded-2xl border ${panelBase}`}>
          <BrandLogo showWordmark={false} markClassName="mx-auto mb-4 h-14 w-14 opacity-70" />
          <h2 className={`text-2xl font-bold mb-2 text-slate-900 dark:text-slate-100`}>{ui("Article not found")}</h2>
          <p className={`mb-6 ${mutedText}`}>{error}</p>
          <Link to="/" className="inline-block px-6 py-3 rounded-xl bg-[var(--brand)] text-white font-semibold hover:bg-[var(--brand-hover)] transition-all">{ui("Go to Homepage")} </Link>
        </motion.div>
      </div>
    );
  }

  // Apply translated text fields (when active) over the original article.
  // Metrics/sidebar/chat keep the original article for accuracy.
  const displayArticle: NewsArticle = {
    ...article,
    title: tr.title,
    description: tr.description,
    content: tr.content,
    aiSummary: tr.aiSummary,
    // Translated plain text must not be hidden by original-language blocks.
    contentBlocks: tr.isAutoTranslated ? [] : article.contentBlocks,
  };

  // Sidebar content extracted to avoid duplication between desktop and mobile
  const sidebar = (
    <ArticleSidebar
      article={article}
      isDark={isDark}
      t={t}
      categorySentimentDistribution={categorySentimentDistribution}
      sentimentEvidence={overview?.evidence}
      sentimentSources={overview?.bySource}
      categoryArticles={categoryArticles}
      categoryTrendingKeywords={trendingKeywords ?? []}
      categoryLiveEngagement={categoryLiveEngagement}
    />
  );

  return (
    <div className="article-reading-layout px-4 md:px-6 py-4 lg:flex lg:h-full lg:min-h-0 lg:flex-col">
      <SeoMetadata article={article} />
      {/* Reading progress, driven by the page's own scroll (CSS only). */}
      <div aria-hidden="true" className="reading-progress" />
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-3 shrink-0">
        <button type="button" onClick={handleBackToHome} className={`-ml-2 inline-flex min-h-9 items-center gap-2 rounded-lg px-2 text-sm font-medium transition-colors ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 dark:text-blue-400 hover:text-blue-700'}`}>
          <ArrowLeft size={16} />{t.backToHome}
        </button>
      </motion.div>

      <div data-testid="article-sentiment-layout" className="lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:grid-rows-[minmax(0,1fr)] gap-6">
        {/* Match the shell's 60:40 content-to-sentiment split at desktop widths. */}
        <div id="article-reading-scroll" ref={readingFade.ref} style={fadeMask(readingFade.above, readingFade.below, 10)} role="region" aria-label={ui('Article content')} tabIndex={0} className="min-w-0 pb-10 lg:min-h-0 lg:overflow-x-hidden lg:overflow-y-auto lg:pr-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
          <div className="mb-5">
            <LanguageSwitcher isDark={isDark} isLoading={tr.isLoading} isAutoTranslated={tr.isAutoTranslated} error={tr.error} onRetry={tr.retry} selectedLanguage={tr.selectedLanguage} onSelectLanguage={tr.setSelectedLanguage} />
          </div>
          {/* No entrance of its own: the hero image arrives through the view transition from the card. */}
          <motion.article initial={false} animate={{ opacity: 1, y: 0 }} className="min-w-0">
            <ArticleHeader article={displayArticle} isDark={isDark} />
            <ArticleBody article={displayArticle} isDark={isDark} />
            <ArticleFooter article={article} isDark={isDark} />
          </motion.article>
          {POSTS_ENABLED && <ArticleQuotes key={getArticleId(article)} articleId={getArticleId(article)} />}
          <div className="hidden lg:block"><Footer /></div>
        </div>

        {/* Sidebar — desktop: scales with the article instead of keeping a fixed width. */}
        <div className="hidden min-h-0 min-w-0 lg:block">
          <motion.aside
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35, delay: 0.05 }}
            id="article-analysis-scroll" role="region" aria-label={ui('Article analysis')} tabIndex={0}
            ref={analysisFade.ref}
            className="h-full min-w-0 overflow-x-hidden overflow-y-auto pb-6 pr-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            style={{ scrollbarWidth: 'none', ...fadeMask(analysisFade.above, analysisFade.below, 10) }}
          >
            {sidebar}
          </motion.aside>
        </div>
      </div>

      {/* Sidebar — mobile */}
      <div className="lg:hidden py-8">
        <motion.aside initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
          {sidebar}
        </motion.aside>
      </div>
      <div className="lg:hidden"><Footer /></div>

      {/* AI chat (Groq via backend proxy) */}
      <ArticleChat article={article} isDark={isDark} />
    </div>
  );
}
