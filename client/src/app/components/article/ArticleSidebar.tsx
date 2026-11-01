import { useUiText, useUiLocale } from '../../i18n/uiText';
import { useTitleTranslations } from '../../hooks/useTitleTranslations';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import {
  Building2,
  Clock3,
  ExternalLink,
  Gauge,
  Globe,
  Info,
  Link2,
  MapPin,
  PieChart,
  ScanSearch,
  Tag,
  TrendingUp,
  Users,
} from 'lucide-react';
import { SentimentExplorer } from '../sentiment/SentimentExplorer';
import { SentimentReasons } from '../sentiment/SentimentReasons';
import type { SourceSentiments, SentimentEvidence } from '../../hooks/useStats';
import { ArticleSentimentPanel } from '../ArticleSentimentPanel';
import { ReadabilityPanel } from './ReadabilityPanel';
import { PanelHeading } from '../ui/PanelHeading';
import { getArticleId } from '../../services/newsAPI';
import type { Translations } from '../../i18n/translations';
import type { LiveEngagementItem, NewsArticle, TrendingKeyword } from '../../types/article';
import type { SentimentDistributionItem } from '../../types/sentiment';
import { emptyNote } from '../ui/styles';
import {
  formatAccessStatus,
  formatCountryName,
  formatLanguageName,
  formatCount,
  formatHost,
  formatPercent,
  formatPublishedDate,
  formatRelativeTime,
  mutedTextClass,
  panelBaseClass,
  sentimentTextClass,
} from './helpers';

interface EntityBlockProps {
  title: string;
  values: string[];
  icon: ReactNode;
  isDark: boolean;
}

function EntityBlock({ title, values, icon }: EntityBlockProps) {
  const ui = useUiText();
  return (
    <div>
      <h4
        className={`text-sm font-semibold mb-2 flex items-center gap-2 text-slate-800 dark:text-slate-200`}
      >
        {icon}
        {title}
      </h4>
      {values.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {values.map((value) => (
            <span
              key={`${title}-${value}`}
              className={`min-w-0 max-w-full break-words px-2.5 py-1 rounded-full text-xs bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200`}
            >
              {value}
            </span>
          ))}
        </div>
      ) : (
        <p className={`text-sm text-slate-500 dark:text-slate-500`}>{ui("None listed")}</p>
      )}
    </div>
  );
}

interface MetricRowProps {
  label: string;
  value: string;
  isDark: boolean;
  accentClass?: string;
}

function MetricRow({ label, value, accentClass }: MetricRowProps) {
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 bg-slate-50/80 dark:bg-slate-900/40`}
    >
      <span className={`text-xs text-slate-500 dark:text-slate-400`}>{label}</span>
      <span
        className={`min-w-0 break-words text-right text-sm font-semibold ${accentClass ?? ('text-slate-900 dark:text-slate-100')}`}
      >
        {value}
      </span>
    </div>
  );
}

interface ArticleSidebarProps {
  sentimentEvidence?: SentimentEvidence;
  sentimentSources?: SourceSentiments[];
  article: NewsArticle;
  isDark: boolean;
  t: Translations;
  categorySentimentDistribution: SentimentDistributionItem[];
  categoryArticles: NewsArticle[];
  categoryTrendingKeywords: TrendingKeyword[];
  categoryLiveEngagement: LiveEngagementItem[];
}

const SIDEBAR_LIST_LIMIT = 10;

function ShowMoreToggle({ count, open, onToggle }: { count: number; open: boolean; onToggle: () => void }) {
  const ui = useUiText();
  if (count <= SIDEBAR_LIST_LIMIT) return null;
  return (
    <button type="button" aria-expanded={open} onClick={onToggle} className="mt-3 rounded px-1 py-2 text-xs font-semibold text-[var(--brand)] hover:underline">
      {open ? ui('Show less') : `${ui('Show more')} (${count - SIDEBAR_LIST_LIMIT})`}
    </button>
  );
}

export function ArticleSidebar({
  sentimentEvidence,
  sentimentSources,
  article,
  isDark,
  t,
  categorySentimentDistribution,
  categoryArticles,
  categoryTrendingKeywords,
}: ArticleSidebarProps) {
  const ui = useUiText();
  const locale = useUiLocale();
  const panelBase = panelBaseClass();
  const mutedText = mutedTextClass();

  const categorySentimentTotal = useMemo(
    () => categorySentimentDistribution.reduce((sum, item) => sum + item.count, 0),
    [categorySentimentDistribution],
  );

  const categoryArticlePreview = useTitleTranslations(categoryArticles);

  const categoryMaxKeywordCount = useMemo(
    () => categoryTrendingKeywords.reduce((max, item) => Math.max(max, item.count), 1),
    [categoryTrendingKeywords],
  );

  // Long lists grow in place behind a toggle instead of scrolling inside the
  // sidebar, which would trap the wheel and touch scroll of the page.
  const [showAllTopics, setShowAllTopics] = useState(false);
  const [showAllLive, setShowAllLive] = useState(false);
  useEffect(() => { setShowAllTopics(false); setShowAllLive(false); }, [article.id]);

  return (
    <div className="min-w-0 space-y-4 [overflow-wrap:anywhere]">
      <ArticleSentimentPanel article={article} isDark={isDark} />

      {/* Category Sentiment Distribution — right under the article's own
          sentiment so the single-article and category views read together. */}
      <div className={`rounded-2xl border p-5 ${panelBase}`}>
        <PanelHeading icon={PieChart} isDark={isDark} className="mb-2">{ui("Category sentiment distribution")}</PanelHeading>
        <p className={`text-xs mb-4 ${mutedText}`}>{ui(article.topic)} {ui("articles in current dataset")}</p>

        <SentimentExplorer counts={{ positive: categorySentimentDistribution.find(item => item.type === 'positive')?.count ?? 0, neutral: categorySentimentDistribution.find(item => item.type === 'neutral')?.count ?? 0, negative: categorySentimentDistribution.find(item => item.type === 'negative')?.count ?? 0 }} sources={sentimentSources} scopeKey={article.topic} />

        <div className="flex items-center justify-between mt-4 text-xs">
          <span className={mutedText}>{ui("Total in category")}</span>
          <span className={`font-semibold text-slate-800 dark:text-slate-200`}>
            {categorySentimentTotal}
          </span>
        </div>
        <SentimentReasons evidence={sentimentEvidence} />
      </div>

      <ReadabilityPanel article={article} isDark={isDark} />

      <div className={`rounded-2xl border p-5 ${panelBase}`}>
        <PanelHeading icon={Info} isDark={isDark}>{ui("Article details")}</PanelHeading>
        <div className="space-y-2.5">
          <MetricRow
            label={ui("Sentiment model")}
            value={article.sentiment.model || ui('Unknown')}
            isDark={isDark}
          />
          <MetricRow
            label={ui("Toxicity score")}
            value={!/^en(?:[-_]|$)/i.test(article.language || article.source.language || '')
              ? ui('Not applicable')
              : article.toxicity.score === null ? ui('Unavailable') : formatPercent(article.toxicity.score)}
            isDark={isDark}
            accentClass={
              article.toxicity.score !== null && article.toxicity.score > 0.5
                ? 'text-red-500'
                : 'text-slate-900 dark:text-slate-100'
            }
          />
          <p className={`text-xs leading-relaxed ${mutedText}`}>{ui("Toxicity is estimated on an English text excerpt by unitary/toxic-bert. Non-English articles are not scored; unavailable does not mean zero.")}</p>
          <MetricRow
            label={ui("Word count")}
            value={formatCount(article.readability.wordCount)}
            isDark={isDark}
          />
        </div>
      </div>

      <div className={`rounded-2xl border p-5 ${panelBase}`}>
        <PanelHeading icon={Globe} isDark={isDark}>{ui("Source and access")}</PanelHeading>
        <div className="space-y-2.5">
          <MetricRow label={ui("Source")} value={article.source.name} isDark={isDark} />
          <MetricRow
            label={ui("Domain")}
            value={article.source.domain || formatHost(article.url)}
            isDark={isDark}
          />
          <MetricRow label={ui("Country")} value={formatCountryName(article.source.country, locale)} isDark={isDark} />
          <MetricRow
            label={ui("Language")}
            value={formatLanguageName(article.language || article.source.language, locale)}
            isDark={isDark}
          />
          <MetricRow label={ui("Section")} value={article.section || ui('Unspecified')} isDark={isDark} />
          <MetricRow label={ui("Access")} value={ui(formatAccessStatus(article))} isDark={isDark} />
          <p className={`text-xs leading-relaxed ${mutedText}`}>{ui('Access describes whether the publisher marks the original article as free or restricted. Missing metadata does not mean it is restricted.')}</p>
          <MetricRow
            label={ui("Updated")}
            value={article.modifiedAt ? formatPublishedDate(article.modifiedAt, locale) : ui('Unavailable')}
            isDark={isDark}
          />
          <MetricRow
            label={ui("Scraped")}
            value={article.scrapedAt ? formatPublishedDate(article.scrapedAt, locale) : ui('Unavailable')}
            isDark={isDark}
          />
        </div>
      </div>

      <div className={`rounded-2xl border p-5 ${panelBase}`}>
        <PanelHeading icon={Tag} isDark={isDark}>{ui("Keywords and tags")}</PanelHeading>
        {article.keywords.length > 0 ? (
          <div className="flex flex-wrap gap-2 mb-4">
            {article.keywords.map((keyword) => (
              <span
                key={`keyword-${keyword}`}
                className={`px-2.5 py-1 rounded-full text-xs bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200`}
              >
                #{keyword}
              </span>
            ))}
          </div>
        ) : (
          <p className={`mb-4 ${emptyNote}`}>{ui("No keywords extracted for this article.")}</p>
        )}
        {article.metaTags.length > 0 && (
          <div>
            <p className={`text-xs font-medium mb-2 ${mutedText}`}>{ui("Meta tags")}</p>
            <div className="flex flex-wrap gap-2">
              {article.metaTags.map((tagValue) => (
                <span
                  key={`meta-${tagValue}`}
                  className={`px-2.5 py-1 rounded-full text-xs bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300`}
                >
                  {tagValue}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Trending Topics */}
      <div className={`rounded-2xl border p-5 ${panelBase}`}>
        <PanelHeading icon={TrendingUp} isDark={isDark} className="mb-3">{ui("Trending topics (")}{ui(article.topic)})</PanelHeading>
        <div role="region" aria-label={ui('Trending topics')} className="min-w-0 space-y-2">
          {categoryTrendingKeywords.length === 0 ? (
            <p className={`text-sm text-slate-500 dark:text-slate-400`}>
              {t.noResults}
            </p>
          ) : (
            (showAllTopics ? categoryTrendingKeywords : categoryTrendingKeywords.slice(0, SIDEBAR_LIST_LIMIT)).map((topic, index) => (
              <div key={`${article.topic}-${topic.keyword}`} className="flex items-center gap-2">
                <span className={`text-xs font-bold w-4 ${mutedText}`}>{index + 1}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-0.5">
                    <span
                      className={`text-xs font-medium text-slate-800 dark:text-slate-100`}
                    >
                      {topic.keyword}
                    </span>
                    <span className={`text-xs ${mutedText}`}>{topic.count}</span>
                  </div>
                  <div
                    className={`h-1.5 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-700`}
                  >
                    <div
                      className="h-full rounded-full transition-[width] duration-300 ease-out"
                      style={{
                        width: `${(topic.count / categoryMaxKeywordCount) * 100}%`,
                        background: 'var(--brand)',
                      }}
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        <ShowMoreToggle count={categoryTrendingKeywords.length} open={showAllTopics} onToggle={() => setShowAllTopics(open => !open)} />
      </div>

      {/* Live View */}
      <div className={`rounded-2xl border p-5 ${panelBase}`}>
        <div className="flex items-center justify-between gap-2 mb-3">
          <PanelHeading icon={Clock3} isDark={isDark} className="">{ui("Live view (")}{ui(article.topic)})</PanelHeading>
          <span
            className={`text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300`}
          >
            {categoryArticles.length} {ui("articles")} </span>
        </div>
        <div role="region" aria-label={ui('Live view')} className="min-w-0 space-y-2.5">
          {categoryArticlePreview.length === 0 ? (
            <p className={`text-sm text-slate-500 dark:text-slate-400`}>
              {t.noResults}
            </p>
          ) : (
            (showAllLive ? categoryArticlePreview : categoryArticlePreview.slice(0, SIDEBAR_LIST_LIMIT)).map((categoryArticle) => (
              <Link
                key={categoryArticle.id}
                to={`/article/${getArticleId(categoryArticle)}`}
                className={`block rounded-xl p-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/60`}
              >
                <p
                  className={`text-sm font-medium line-clamp-2 text-slate-900 dark:text-slate-100`}
                >
                  {categoryArticle.title}
                </p>
                <div className="flex items-center gap-2 mt-1.5 text-xs flex-wrap">
                  <span className={mutedText}>
                    {ui(formatRelativeTime(categoryArticle.publishedAt))}
                  </span>
                  <span className={`text-slate-500 dark:text-slate-400`}>.</span>
                  <span className={sentimentTextClass[categoryArticle.sentiment.type]}>
                    {t[categoryArticle.sentiment.type]}
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
        <ShowMoreToggle count={categoryArticlePreview.length} open={showAllLive} onToggle={() => setShowAllLive(open => !open)} />
      </div>

      {/* Entities */}
      <div className={`rounded-2xl border p-5 ${panelBase}`}>
        <PanelHeading icon={ScanSearch} isDark={isDark}>{ui("Entities")}</PanelHeading>
        <div className="space-y-4">
          <EntityBlock
            title={ui("Persons")}
            values={article.entities.persons}
            icon={<Users size={14} className="text-blue-600 dark:text-blue-400" />}
            isDark={isDark}
          />
          <EntityBlock
            title={ui("Organizations")}
            values={article.entities.organizations}
            icon={<Building2 size={14} className="text-blue-600 dark:text-blue-400" />}
            isDark={isDark}
          />
          <EntityBlock
            title={ui("Locations")}
            values={article.entities.locations}
            icon={<MapPin size={14} className="text-blue-600 dark:text-blue-400" />}
            isDark={isDark}
          />
          <EntityBlock
            title={ui("Misc")}
            values={article.entities.misc}
            icon={<Gauge size={14} className="text-blue-600 dark:text-blue-400" />}
            isDark={isDark}
          />
        </div>
      </div>

      {/* Related Coverage */}
      <div className={`rounded-2xl border p-5 ${panelBase}`}>
        <PanelHeading icon={Link2} isDark={isDark}>{ui("Related coverage")}</PanelHeading>
        <div className="space-y-2.5">
          {article.relatedUrls.length === 0 ? (
            <p className={emptyNote}>{ui("No related links extracted.")}</p>
          ) : (
            article.relatedUrls.slice(0, 6).map((url) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className={`block rounded-xl p-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/60`}
              >
                <p
                  className={`text-sm font-medium line-clamp-2 text-slate-900 dark:text-slate-100`}
                >
                  {url}
                </p>
                <div className="flex items-center gap-2 mt-1 text-xs">
                  <span className={mutedText}>{formatHost(url)}</span>
                  <ExternalLink size={14} className={mutedText} />
                </div>
              </a>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
