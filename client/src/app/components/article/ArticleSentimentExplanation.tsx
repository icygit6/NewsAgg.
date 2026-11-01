import { useQuery } from '@tanstack/react-query';
import { useApp } from '../../contexts/AppContext';
import { useUiText } from '../../i18n/uiText';
import { API_BASE_URL } from '../../lib/apiFetch';
import { ExplanationSkeleton } from '../ui/ContentSkeleton';
import type { NewsArticle } from '../../types/article';

interface Explanation { summary: string; reasons: { reason: string; quote: string }[]; model: string; partial: boolean }
export function ArticleSentimentExplanation({ article, compact = false, showNote = true }: { article: Pick<NewsArticle, 'id'>; compact?: boolean; showNote?: boolean }) {
  const ui = useUiText();
  const { language } = useApp();
  const lang = language === 'zhTW' ? 'zh-TW' : 'en';
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['article-explanation', article.id, lang],
    queryFn: async ({ signal }) => {
      const response = await fetch(`${API_BASE_URL}/api/articles/${encodeURIComponent(article.id)}/sentiment-explanation?lang=${lang}`, { signal });
      if (!response.ok) throw new Error('Explanation unavailable');
      const json = await response.json();
      if (!json.success) throw new Error('Explanation unavailable');
      return json.data as Explanation;
    },
    staleTime: 24 * 60 * 60 * 1000,
    retry: false,
  });
  return <div className={`mt-2 min-w-0 leading-relaxed [overflow-wrap:anywhere] ${compact ? 'text-xs' : 'text-sm'}`} data-testid="article-ai-explanation">
    {isPending ? <ExplanationSkeleton /> : isError ? <div role="status"><p>{ui('The AI explanation is temporarily unavailable. Please try again.')}</p><button type="button" onClick={() => void refetch()} className="mt-2 min-h-11 rounded-lg border px-3">{ui('Try again')}</button></div> : data && <>
      <p>{data.summary}</p>
      {!compact && <details className="mt-2">
        <summary className={`cursor-pointer py-3 text-xs font-semibold text-blue-700 dark:text-blue-300`}>{ui('Reasons and supporting excerpts')}</summary>
        <ol className="space-y-4">{data.reasons.map((reason, index) => <li key={index}>
          <p>{reason.reason}</p>
          <blockquote className={`mt-2 rounded-lg p-3 text-xs bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300`}>“{reason.quote}”</blockquote>
        </li>)}</ol>
        <p className="mt-3 text-xs">{ui('Explanation model')}: {data.model}</p>
      </details>}
      {(showNote || data.partial) && <p className={`mt-2 text-xs text-slate-600 dark:text-slate-400`}>{showNote && ui('AI interpretation of the article’s content; not the original classifier’s internal reasoning.')}{data.partial && <>{showNote && ' '}{ui('Based on excerpts from the beginning, middle and end of the stored article.')}</>}</p>}
    </>}
  </div>;
}
