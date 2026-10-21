import { useUiText, useUiLocale } from '../../i18n/uiText';
import { useTitleTranslations } from '../../hooks/useTitleTranslations';
import { useMemo, type ReactNode } from 'react';
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
import { DonutChart } from '../sentiment/DonutChart';
import { ArticleSentimentPanel } from '../ArticleSentimentPanel';
import { ReadabilityPanel } from './ReadabilityPanel';
import { PanelHeading } from '../ui/PanelHeading';
import { getArticleId } from '../../services/newsAPI';
import type { Translations } from '../../i18n/translations';
import type { LiveEngagementItem, NewsArticle, TrendingKeyword } from '../../types/article';
import type { SentimentDistributionItem } from '../../types/sentiment';
import {
  SENTIMENT_BAR_STYLE,
  SENTIMENT_CHART_COLORS,
  SENTIMENT_STYLE,
  formatAccessStatus,
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

function EntityBlock({ title, values, icon, isDark }: EntityBlockProps) {
  const ui = useUiText();
  return (
    <div>
      <h4
        className={`text-sm font-semibold mb-2 flex items-center gap-2 ${isDark ? 'text-slate-200' : 'text-gray-800'}`}
      >
        {icon}
        {title}
      </h4>
      {values.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {values.map((value) => (
            <span
              key={`${title}-${value}`}
              className={`px-2.5 py-1 rounded-full text-xs ${isDark ? 'bg-slate-700 text-slate-200' : 'bg-gray-100 text-gray-700'}`}
            >
              {value}
            </span>
          ))}
        </div>
      ) : (
        <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>{ui("None listed")}</p>
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

function MetricRow({ label, value, isDark, accentClass }: MetricRowProps) {
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 ${isDark ? 'bg-slate-900/40' : 'bg-gray-50/80'}`}
    >
      <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>{label}</span>
      <span
        className={`text-sm font-semibold ${accentClass ?? (isDark ? 'text-slate-100' : 'text-gray-900')}`}
      >
        {value}
      </span>
    </div>
  );
}

interface ArticleSidebarProps {
  article: NewsArticle;
  isDark: boolean;
  t: Translations;
  categorySentimentDistribution: SentimentDistributionItem[];
  categoryArticles: NewsArticle[];
  categoryTrendingKeywords: TrendingKeyword[];
  categoryLiveEngagement: LiveEngagementItem[];
}

export function ArticleSidebar({
  article,
  isDark,
  t,
  categorySentimentDistribution,
  categoryArticles,
  categoryTrendingKeywords,
}: ArticleSidebarProps) {
  const ui = useUiText();
  const locale = useUiLocale();
  const panelBase = panelBaseClass(isDark);
  const mutedText = mutedTextClass(isDark);

  const categorySentimentTotal = useMemo(
    () => categorySentimentDistribution.reduce((sum, item) => sum + item.count, 0),
    [categorySentimentDistribution],
  );

  const categorySentimentChartData = useMemo(
    () =>
      categorySentimentDistribution.map((item) => ({
        type: item.type,
        name: t[item.type],
        value: item.count,
        color: SENTIMENT_CHART_COLORS[item.type],
      })),
    [categorySentimentDistribution, t],
  );

  const categoryArticlePreview = useTitleTranslations(categoryArticles.slice(0, 12));

  const categoryMaxKeywordCount = useMemo(
    () => categoryTrendingKeywords.reduce((max, item) => Math.max(max, item.count), 1),
    [categoryTrendingKeywords],
  );

  return (
    <div className="space-y-4">
      <ArticleSentimentPanel article={article} isDark={isDark} />
      <ReadabilityPanel article={article} isDark={isDark} />

      {/* Category Sentiment Distribution — right under the article's own
          sentiment so the single-article and category views read together. */}
      <div className={`rounded-2xl border p-5 ${panelBase}`}>
        <PanelHeading icon={PieChart} isDark={isDark} className="mb-2">{ui("Category Sentiment Distribution")}</PanelHeading>
        <p className={`text-xs mb-4 ${mutedText}`}>{ui(article.topic)} {ui("articles in current dataset")}</p>

        <div className="mb-4">
          <DonutChart segments={categorySentimentChartData} size={120} isDark={isDark} />
        </div>

        <div className="space-y-2.5">
          {categorySentimentDistribution.map((item) => {
            const percentage =
              categorySentimentTotal > 0
                ? Math.round((item.count / categorySentimentTotal) * 100)
                : 0;
            return (
              <div key={item.type} className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`w-16 text-xs ${mutedText}`}>{t[item.type]}</span>
                  <div
                    className={`h-2 rounded-full overflow-hidden flex-1 ${isDark ? 'bg-slate-700' : 'bg-gray-100'}`}
                  >
                    <div
                      className={`h-full rounded-full ${SENTIMENT_BAR_STYLE[item.type]}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className={`text-xs font-semibold ${SENTIMENT_STYLE[item.type].label}`}>
                    {item.count} ({percentage}%)
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between mt-4 text-xs">
          <span className={mutedText}>{ui("Total in category")}</span>
          <span className={`font-semibold ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>
            {categorySentimentTotal}
          </span>
        </div>
      </div>

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
                : isDark
                  ? 'text-slate-100'
                  : 'text-gray-900'
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
        <PanelHeading icon={Globe} isDark={isDark}>{ui("Source and Access")}</PanelHeading>
        <div className="space-y-2.5">
          <MetricRow label={ui("Source")} value={article.source.name} isDark={isDark} />
          <MetricRow
            label={ui("Domain")}
            value={article.source.domain || formatHost(article.url)}
            isDark={isDark}
          />
          <MetricRow label={ui("Country")} value={article.source.country || ui('Unknown')} isDark={isDark} />
          <MetricRow
            label={ui("Language")}
            value={(article.language || article.source.language || 'Unknown').toUpperCase()}
            isDark={isDark}
          />
          <MetricRow label={ui("Section")} value={article.section || ui('Unspecified')} isDark={isDark} />
          <MetricRow label={ui("Access")} value={ui(formatAccessStatus(article))} isDark={isDark} />
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
        <PanelHeading icon={Tag} isDark={isDark}>{ui("Keywords and Tags")}</PanelHeading>
        {article.keywords.length > 0 ? (
          <div className="flex flex-wrap gap-2 mb-4">
            {article.keywords.map((keyword) => (
              <span
                key={`keyword-${keyword}`}
                className={`px-2.5 py-1 rounded-full text-xs ${isDark ? 'bg-slate-700 text-slate-200' : 'bg-gray-100 text-gray-700'}`}
              >
                #{keyword}
              </span>
            ))}
          </div>
        ) : (
          <p className={`text-sm mb-4 ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>{ui("No keywords extracted for this article.")} </p>
        )}
        {article.metaTags.length > 0 && (
          <div>
            <p className={`text-xs font-medium mb-2 ${mutedText}`}>{ui("Meta tags")}</p>
            <div className="flex flex-wrap gap-2">
              {article.metaTags.map((tagValue) => (
                <span
                  key={`meta-${tagValue}`}
                  className={`px-2.5 py-1 rounded-full text-xs ${isDark ? 'bg-cyan-500/15 text-cyan-300' : 'bg-cyan-50 text-cyan-700'}`}
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
        <PanelHeading icon={TrendingUp} isDark={isDark} className="mb-3">{ui("Trending Topics (")}{ui(article.topic)})</PanelHeading>
        <div className="space-y-2">
          {categoryTrendingKeywords.length === 0 ? (
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
              {t.noResults}
            </p>
          ) : (
            categoryTrendingKeywords.map((topic, index) => (
              <div key={`${article.topic}-${topic.keyword}`} className="flex items-center gap-2">
                <span className={`text-xs font-bold w-4 ${mutedText}`}>{index + 1}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-0.5">
                    <span
                      className={`text-xs font-medium ${isDark ? 'text-slate-100' : 'text-gray-800'}`}
                    >
                      {topic.keyword}
                    </span>
                    <span className={`text-xs ${mutedText}`}>{topic.count}</span>
                  </div>
                  <div
                    className={`h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-slate-700' : 'bg-gray-100'}`}
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
      </div>

      {/* Live View */}
      <div className={`rounded-2xl border p-5 ${panelBase}`}>
        <div className="flex items-center justify-between gap-2 mb-3">
          <PanelHeading icon={Clock3} isDark={isDark} className="">{ui("Live View (")}{ui(article.topic)})</PanelHeading>
          <span
            className={`text-[11px] px-2 py-0.5 rounded-full ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-gray-100 text-gray-600'}`}
          >
            {categoryArticles.length} {ui("articles")} </span>
        </div>
        <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
          {categoryArticlePreview.length === 0 ? (
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
              {t.noResults}
            </p>
          ) : (
            categoryArticlePreview.map((categoryArticle) => (
              <Link
                key={categoryArticle.id}
                to={`/article/${getArticleId(categoryArticle)}`}
                className={`block rounded-xl p-2.5 transition-colors ${isDark ? 'hover:bg-slate-700/60' : 'hover:bg-gray-50'}`}
              >
                <p
                  className={`text-sm font-medium line-clamp-2 ${isDark ? 'text-slate-100' : 'text-gray-900'}`}
                >
                  {categoryArticle.title}
                </p>
                <div className="flex items-center gap-2 mt-1.5 text-xs flex-wrap">
                  <span className={mutedText}>
                    {ui(formatRelativeTime(categoryArticle.publishedAt))}
                  </span>
                  <span className={`${isDark ? 'text-slate-400' : 'text-gray-500'}`}>.</span>
                  <span className={sentimentTextClass[categoryArticle.sentiment.type]}>
                    {t[categoryArticle.sentiment.type]}
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

      {/* Entities */}
      <div className={`rounded-2xl border p-5 ${panelBase}`}>
        <PanelHeading icon={ScanSearch} isDark={isDark}>{ui("Entities")}</PanelHeading>
        <div className="space-y-4">
          <EntityBlock
            title={ui("Persons")}
            values={article.entities.persons}
            icon={<Users size={14} className="text-cyan-500" />}
            isDark={isDark}
          />
          <EntityBlock
            title={ui("Organizations")}
            values={article.entities.organizations}
            icon={<Building2 size={14} className="text-cyan-500" />}
            isDark={isDark}
          />
          <EntityBlock
            title={ui("Locations")}
            values={article.entities.locations}
            icon={<MapPin size={14} className="text-cyan-500" />}
            isDark={isDark}
          />
          <EntityBlock
            title={ui("Misc")}
            values={article.entities.misc}
            icon={<Gauge size={14} className="text-cyan-500" />}
            isDark={isDark}
          />
        </div>
      </div>

      {/* Related Coverage */}
      <div className={`rounded-2xl border p-5 ${panelBase}`}>
        <PanelHeading icon={Link2} isDark={isDark}>{ui("Related Coverage")}</PanelHeading>
        <div className="space-y-2.5">
          {article.relatedUrls.length === 0 ? (
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>{ui("No related links extracted.")} </p>
          ) : (
            article.relatedUrls.slice(0, 6).map((url) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className={`block rounded-xl p-2.5 transition-colors ${isDark ? 'hover:bg-slate-700/60' : 'hover:bg-gray-50'}`}
              >
                <p
                  className={`text-sm font-medium line-clamp-2 ${isDark ? 'text-slate-100' : 'text-gray-900'}`}
                >
                  {url}
                </p>
                <div className="flex items-center gap-2 mt-1 text-[11px]">
                  <span className={mutedText}>{formatHost(url)}</span>
                  <ExternalLink size={12} className={mutedText} />
                </div>
              </a>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
