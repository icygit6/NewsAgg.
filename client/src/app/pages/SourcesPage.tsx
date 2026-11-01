import { useUiText } from '../i18n/uiText';
import { ChevronDown, ExternalLink, Rss } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { DocLayout } from '../components/ui/DocLayout';
import { SourceLogo } from '../components/ui/SourceLogo';
import { SOURCES } from '../constants';
import catalog from '../data/sourceCatalog.json';

type Entry = (typeof catalog)[number]['entries'][number];
const kinds = ['Section page', 'Category feed / sitemap', 'Shared feed / sitemap'];
const zhCategories: Record<string, string> = { Business: '商業', Climate: '氣候', Health: '健康', Lifestyle: '生活', Politics: '政治', Science: '科學', Sport: '體育', World: '國際' };

function discoveryUrl(entry: Entry, now: Date) {
  const date = entry.monthsAgo !== null
    ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - entry.monthsAgo, 1))
    : new Date(now.getTime() - (entry.daysAgo ?? 0) * 86400000);
  return entry.url.replace('{year}', String(date.getUTCFullYear()))
    .replace('{month}', String(date.getUTCMonth() + 1).padStart(2, '0'))
    .replace('{day}', String(date.getUTCDate()).padStart(2, '0'));
}


export function SourcesPage({ embedded = false }: { embedded?: boolean }) {
  const ui = useUiText();
  const { language, isDark } = useApp();
  const zh = language === 'zhTW';
  const now = new Date();
  const title = ui('Collection sources');
  const intro = ui('Section pages, RSS feeds and sitemaps from four publishers. These are configured discovery links, not a visit log; articles must pass publication checks. Dated links follow the UTC calendar.');
  const content = <div className="divide-y divide-slate-200 dark:divide-slate-700">
    {catalog.map(source => {
      const known = SOURCES.find(item => item.id === source.id);
      return <details key={source.id} id={`collection-${source.id}`} className="group/source min-w-0 scroll-mt-6 py-4 first:pt-0 last:pb-0">
        <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-[var(--brand)] [&::-webkit-details-marker]:hidden">
          <SourceLogo source={{ ...source, domain: known?.domain }} isDark={isDark} className="h-10 w-10" />
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold">{source.name}</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">{known?.domain} · {source.language === 'en' ? (ui('English')) : (ui('Traditional Chinese'))}</p>
          </div>
          <span className="shrink-0 text-xs tabular-nums text-slate-600 dark:text-slate-400">{source.entries.length} {ui('links')}</span>
        <ChevronDown size={20} aria-hidden="true" className="shrink-0 text-slate-500 transition-transform group-open/source:rotate-180" /></summary>
        {kinds.map((kind, index) => {
          const group = source.entries.filter(entry => entry.kind === kind);
          if (!group.length) return null;
          return <div key={kind} className="mt-4 first:mt-0">
            <h4 className="mb-1 text-xs font-semibold text-slate-600 dark:text-slate-300">{zh ? ['分類頁', '分類 RSS / 網站地圖', '共享 RSS / 網站地圖'][index] : kind} <span className="font-normal tabular-nums">· {group.length}</span></h4>
            <ul className="grid min-w-0 gap-x-6 sm:grid-cols-2 xl:grid-cols-3">
              {group.map((entry, i) => {
                const url = discoveryUrl(entry, now);
                return <li key={i} className="min-w-0 border-b border-slate-100 dark:border-slate-800">
                  <a href={url} target="_blank" rel="noopener noreferrer" className="group flex min-w-0 items-start gap-2 rounded-md px-1 py-2 text-sm transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] dark:hover:bg-slate-800">
                    <span className="min-w-0 flex-1">
                      <span className="block break-all font-medium text-[var(--brand)] group-hover:underline">{url}</span>
                      <span className="mt-0.5 block text-xs leading-5 text-slate-600 dark:text-slate-400">{entry.categories.map(value => zh ? zhCategories[value] ?? value : value).join(' · ')}</span>
                    </span>
                    <ExternalLink size={14} className="mt-1 shrink-0 text-slate-400" aria-hidden="true" />
                  </a>
                </li>;
              })}
            </ul>
          </div>;
        })}
      </details>;
    })}
  </div>;
  if (!embedded) return <DocLayout icon={Rss} title={title} intro={intro} back={ui('Back to home')}>{content}</DocLayout>;
  return <section id="collection-sources" className="min-w-0 scroll-mt-6 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
    <h2 className="text-lg font-bold">{title}</h2>
    <p className="mb-5 mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{intro}</p>

    {content}
  </section>;
}
