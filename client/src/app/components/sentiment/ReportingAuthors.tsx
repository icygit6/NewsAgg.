import { useDeferredValue, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useUiText } from '../../i18n/uiText';
import { AutoPages } from '../ui/AutoPages';
import { InsightMark } from '../ui/InsightMark';
import { Link } from 'react-router';
import { useApp } from '../../contexts/AppContext';
import type { StatsOverview } from '../../hooks/useStats';

export function ReportingAuthors({ authors, total }: { authors: NonNullable<StatsOverview['reportingAuthors']>; total: number }) {
  const ui = useUiText();
  const { language } = useApp();
  const zh = language === 'zhTW';
  const covered = authors.reduce((sum, author) => sum + author.count, 0);
  // Over a thousand bylines is too many to page through, so the list can be narrowed by
  // name or publisher. Deferred so typing stays smooth over the whole list.
  const [query, setQuery] = useState('');
  const needle = useDeferredValue(query.trim().toLocaleLowerCase());
  const matches = useMemo(() => needle
    ? authors.filter(author => `${author.name} ${author.source}`.toLocaleLowerCase().includes(needle))
    : authors, [authors, needle]);
  return <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
    <h3 className="flex items-center gap-2 text-sm font-semibold"><InsightMark kind="authors" />{ui('Reporting authors')} <span className="text-slate-500 tabular-nums">({authors.length.toLocaleString()})</span></h3>
    <p className="mb-3 mt-2 text-xs leading-5 text-slate-600 dark:text-slate-400">{zh ? `目前篩選的 ${total.toLocaleString()} 篇新聞中，${covered.toLocaleString()} 篇有署名。列出全部出版者署名（含新聞團隊），非僅即時新聞。` : `Publisher bylines from ${covered.toLocaleString()} of ${total.toLocaleString()} matching articles, including newsroom credits. All available bylines are listed, beyond Live view.`}</p>
    {authors.length > 10 && <div className="mb-3 flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-slate-900 focus-within:ring-2 focus-within:ring-[var(--brand-ring,rgba(6,182,212,0.5))] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
      <Search size={16} aria-hidden="true" className="shrink-0 text-slate-400 dark:text-slate-500" />
      {/* 16px on phones so focusing the field doesn't zoom the page. */}
      <input type="search" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') setQuery(''); }}
        placeholder={ui('Find an author or publisher')} aria-label={ui('Find an author or publisher')} autoComplete="off"
        className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-slate-400 sm:text-sm [&::-webkit-search-cancel-button]:appearance-none" />
      {query && <button type="button" onClick={() => setQuery('')} aria-label={ui('Clear search')}
        className="-my-1 -mr-2 grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-400 hover:text-slate-600 pointer-coarse:h-11 pointer-coarse:w-11 dark:text-slate-500 dark:hover:text-slate-300"><X size={14} /></button>}
    </div>}
    {matches.length > 0 && <AutoPages label={ui('All reporting authors')} scopeKey={`${total}:${authors[0]?.articleId ?? ''}:${needle}`}
      pageClassName="divide-y divide-slate-100 dark:divide-slate-800"
      items={matches.map(author => <div key={JSON.stringify([author.source, author.name])}>
        <Link to={`/article/${encodeURIComponent(author.articleId)}`} className="flex items-center justify-between gap-3 rounded-lg py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
          <span className="min-w-0"><span className="block break-words text-[var(--brand)]">{author.name}</span><span className="text-xs text-slate-500">{author.source}</span></span>
          <span className="shrink-0 tabular-nums">{author.count.toLocaleString()}</span>
        </Link>
      </div>)} />}
    {!authors.length && <p className="text-xs text-slate-500">{ui('No bylines available for these filters.')}</p>}
    {authors.length > 0 && !matches.length && <p role="status" className="py-2 text-xs text-slate-500">{ui('No authors or publishers match this search.')}</p>}
  </section>;
}
