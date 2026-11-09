import { AutoPages } from '../ui/AutoPages';
import { useUiText } from '../../i18n/uiText';
import { useTitleTranslations } from '../../hooks/useTitleTranslations';
import { Link } from 'react-router';
import { InsightMark } from '../ui/InsightMark';
import { useApp } from '../../contexts/AppContext';
import { getArticleId } from '../../services/newsAPI';
import type { NewsArticle } from '../../types/article';
import type { SentimentType } from '../../types/sentiment';
import { panelBaseClass, chartMutedColor } from './shared';
import { useEffect, useRef, useState } from 'react';
import { CATEGORY_BADGE_CLASS, TOPIC_TO_CATEGORY } from '../../constants';

interface LiveViewProps {
  articles: NewsArticle[];
  categoryLabel: string;
  expanded?: boolean;
}

const formatRelativeTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const diffMinutes = Math.round((Date.now() - date.getTime()) / (1000 * 60));
  if (diffMinutes <= 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  return `${Math.round(diffHours / 24)}d ago`;
};

const sentimentTextClass: Record<SentimentType, string> = {
  positive: 'text-emerald-500',
  neutral: 'text-amber-600 dark:text-amber-400',
  negative: 'text-red-500',
};

export function LiveView({ articles, categoryLabel }: LiveViewProps) {
  const displayArticles = useTitleTranslations(articles);
  const ui = useUiText();
  const { t, isDark } = useApp();
  const mutedColor = chartMutedColor(isDark);
  // Rows that arrive after the first render slide in; the first batch does not.
  // Rows not in the previous list are marked fresh until their entrance ends, so a re-render
  // in between (scroll-fade edges, translations) cannot cut the animation short.
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(() => new Set());
  const urls = articles.map((article) => article.url).join('\n');
  useEffect(() => {
    const current = urls ? urls.split('\n') : [];
    if (seen.current) {
      const previous = seen.current;
      const arrived = current.filter((url) => !previous.has(url));
      if (arrived.length) setFresh((old) => new Set([...old, ...arrived]));
    }
    seen.current = new Set(current);
  }, [urls]);
  const settle = (url: string) => setFresh((old) => { if (!old.has(url)) return old; const next = new Set(old); next.delete(url); return next; });

  return (
    <div className={`rounded-2xl border p-4 ${panelBaseClass()}`}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <InsightMark kind="live" />
          <h3 className={`font-poppins text-sm font-semibold text-slate-800 dark:text-slate-200`}>{ui("Live view")} </h3>
        </div>
        <span className={`shrink-0 whitespace-nowrap text-[11px] tabular-nums px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300`}>
          {articles.length} {ui(articles.length === 1 ? "article" : "articles")} </span>
      </div>

      <p className="text-xs mb-2" style={{ color: mutedColor }}>{ui("Category:")} {categoryLabel}
      </p>

        {articles.length === 0 ? (
          <p className={`text-sm text-slate-500 dark:text-slate-400`}>{t.noResults}</p>
        ) : (
          <AutoPages label={ui("Live view")} scopeKey={categoryLabel}
            pageClassName="space-y-2.5"
            items={displayArticles.map((article) => (
            <Link
              key={article.url}
              to={`/article/${getArticleId(article)}`}
              onAnimationEnd={() => settle(article.url)}
              className={`${fresh.has(article.url) ? 'live-row-in ' : ''}block rounded-xl p-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/60`}
            >
              <p title={article.title} className={`text-sm font-medium line-clamp-2 break-words text-slate-900 dark:text-slate-100`}>
                {article.title}
              </p>
              <div className="flex items-center gap-2 mt-1.5 text-xs flex-wrap">
                <span style={{ color: mutedColor }}>{ui(formatRelativeTime(article.publishedAt))}</span>
                <span className={`text-slate-500 dark:text-slate-400`}>•</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${CATEGORY_BADGE_CLASS[TOPIC_TO_CATEGORY[article.topic]] ?? 'bg-slate-600 text-white'}`}>{ui(article.topic)}</span>
                <span className={`text-slate-500 dark:text-slate-400`}>•</span>
                <span className={sentimentTextClass[article.sentiment.type]}>{t[article.sentiment.type]}</span>
              </div>
            </Link>
          ))} />
        )}
    </div>
  );
}
