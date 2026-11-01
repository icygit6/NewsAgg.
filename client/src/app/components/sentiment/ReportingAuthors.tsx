import { AutoPages } from '../ui/AutoPages';
import { InsightMark } from '../ui/InsightMark';
import { Link } from 'react-router';
import { useApp } from '../../contexts/AppContext';
import type { StatsOverview } from '../../hooks/useStats';

export function ReportingAuthors({ authors, total }: { authors: NonNullable<StatsOverview['reportingAuthors']>; total: number }) {
  const { language } = useApp();
  const zh = language === 'zhTW' || language === 'zhCN';
  const covered = authors.reduce((sum, author) => sum + author.count, 0);
  return <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
    <h3 className="flex items-center gap-2 text-sm font-semibold"><InsightMark kind="authors" />{zh ? '報導作者' : 'Reporting authors'} <span className="text-slate-500 tabular-nums">({authors.length.toLocaleString()})</span></h3>
    <p className="mb-3 mt-2 text-xs leading-5 text-slate-600 dark:text-slate-400">{zh ? `目前篩選的 ${total.toLocaleString()} 篇新聞中，${covered.toLocaleString()} 篇有署名。列出全部出版者署名（含新聞團隊），非僅 Live View。` : `Publisher bylines from ${covered.toLocaleString()} of ${total.toLocaleString()} matching articles, including newsroom credits. All available bylines are listed, beyond Live View.`}</p>
    {authors.length > 0 && <AutoPages label={zh ? '全部報導作者' : 'All reporting authors'} scopeKey={`${total}:${authors[0]?.articleId ?? ''}`}
      pageClassName="divide-y divide-slate-100 dark:divide-slate-800"
      items={authors.map(author => <div key={JSON.stringify([author.source, author.name])}>
        <Link to={`/article/${encodeURIComponent(author.articleId)}`} className="flex items-center justify-between gap-3 rounded-lg py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
          <span className="min-w-0"><span className="block break-words text-[var(--brand)]">{author.name}</span><span className="text-xs text-slate-500">{author.source}</span></span>
          <span className="shrink-0 tabular-nums">{author.count.toLocaleString()}</span>
        </Link>
      </div>)} />}
    {!authors.length && <p className="text-xs text-slate-500">{zh ? '目前篩選沒有可用署名。' : 'No bylines available for these filters.'}</p>}
  </section>;
}
