import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { useBookmarkMeta } from '../../hooks/useBookmarks';
import { collectionChoices, useCollectionLabel } from './collections';
import { ManageCollectionsMenu } from './ManageCollections';
import { useUiText } from '../../i18n/uiText';
import { StyledSelect } from '../ui/StyledSelect';
import { FilterSheet } from '../ui/FilterSheet';
import { filterCount, type FilterControl } from '../ui/filterControl';
import type { SentimentType } from '../../types/sentiment';
import { BookmarkList } from './BookmarkList';

/** Shared bookmark layout for the profile and the dedicated bookmarks page:
 * status and collection selects, then manage, the home feed's filter panel and search. */
export function BookmarkCollection() {
  const ui = useUiText();
  const { user, isDark } = useApp();
  const [search, setSearch] = useState('');
  // The status lives in the URL so the profile drawer can link straight to it.
  const [params, setParams] = useSearchParams();
  const status = ['unread', 'read', 'archived'].includes(params.get('status') ?? '') ? params.get('status')! : '';
  const setStatus = (value: string) => setParams(current => { const next = new URLSearchParams(current); if (value) next.set('status', value); else next.delete('status'); return next; }, { replace: true });
  const [collection, setCollection] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [sentiments, setSentiments] = useState<SentimentType[]>([]);
  const [sort, setSort] = useState('latest');
  const [filterOpen, setFilterOpen] = useState(false);
  const filterAnchor = useRef<HTMLDivElement>(null);
  const meta = useBookmarkMeta(Boolean(user));
  const collectionLabel = useCollectionLabel();
  // Every collection the reader has, empty ones included, not only those with bookmarks in them.
  const collections = collectionChoices(meta.data);

  const control: FilterControl = {
    categories, setCategories, sources, setSources, sentiments, setSentiments, sort, setSort,
    sortOptions: [{ value: 'latest', label: ui('Newest saved') }, { value: 'oldest', label: ui('Oldest saved') }],
    defaultSort: 'latest',
  };
  const active = filterCount(control);
  // The home feed header's round icon button.
  const iconButton = (on: boolean) => `inline-flex items-center justify-center rounded-full p-2 transition-colors pointer-coarse:min-h-11 pointer-coarse:min-w-11 ${on ? 'text-[var(--brand,#2563eb)]' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`;

  return (
    <div>
      {/* Phone: the count and the manage, filter and search icons share the first
          line (the icons would otherwise sit alone on a half-empty row) and the
          selects take the second. From md up the count has its own line and the
          selects stretch across one row with the icons at its end. The icon
          group is where the dropdowns line up, on the page margin. */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <p className="order-1 flex-1 opacity-70 md:basis-full">{meta.data?.total ?? '…'} {ui('saved articles')}</p>
        <div className="relative order-2 flex shrink-0 items-center gap-1 md:order-4">
          <ManageCollectionsMenu meta={meta.data} isDark={isDark} buttonClassName={open => iconButton(open)}
            onRenamed={(from, to) => { if (collection === from) setCollection(to); }}
            onDeleted={name => { if (collection === name) setCollection(''); }} />
          <div ref={filterAnchor} className="shrink-0">
            <button onClick={() => setFilterOpen(open => !open)} aria-expanded={filterOpen} aria-label={ui('Filter bookmarks')} title={ui('Filter bookmarks')}
              className={`flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors pointer-coarse:min-h-11 pointer-coarse:min-w-11 ${active > 0 || filterOpen ? 'text-[var(--brand,#2563eb)]' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
              {/* No count badge: the icon turns the brand colour while any filter is on. */}
              <SlidersHorizontal size={16} aria-hidden="true" />
            </button>
            <FilterSheet open={filterOpen} onClose={() => setFilterOpen(false)} anchorRef={filterAnchor} control={control} align="right" />
          </div>
          <BookmarkSearch value={search} onChange={setSearch} isDark={isDark} buttonClassName={iconButton} />
        </div>
        <div className="order-3 grid basis-full grid-cols-2 gap-2 md:min-w-0 md:flex-1 md:basis-0">
          <StyledSelect label={ui('Filter by status')} value={status} onChange={setStatus} isDark={isDark} menu="panel" options={(['', 'unread', 'read', 'archived'] as const).map((value, i) => {
            const count = meta.data && (value ? meta.data[value] : meta.data.unread + meta.data.read);
            return { value, label: `${ui(['All active', 'Unread', 'Read', 'Archived'][i])}${count === undefined ? '' : ` (${count})`}` };
          })} />
          <StyledSelect label={ui('Filter by collection')} value={collection} onChange={setCollection} isDark={isDark} menu="panel" options={[{ value: '', label: ui('All collections') }, ...collections.map((value: string) => ({ value, label: collectionLabel(value) }))]} />
        </div>
      </div>
      <BookmarkList filters={{ search, status, collection, sort, sources: sources.join(','), categories: categories.join(','), sentiments: sentiments.join(',') }} />
    </div>
  );
}

/** Search as an icon that drops down the home header's search field. The
 * icon stays highlighted while a search is applied. */
function BookmarkSearch({ value, onChange, buttonClassName }: {
  value: string; onChange: (value: string) => void; isDark: boolean; buttonClassName: (on: boolean) => string;
}) {
  const ui = useUiText();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); triggerRef.current?.focus(); } };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('pointerdown', onPointerDown); document.removeEventListener('keydown', onKeyDown); };
  }, [open]);

  return (
    <div ref={rootRef} className="shrink-0">
      <button ref={triggerRef} onClick={() => setOpen(current => !current)} aria-expanded={open} aria-label={ui('Search bookmarks')} title={ui('Search bookmarks')}
        className={`relative ${buttonClassName(open || Boolean(value))}`}>
        {open ? <X size={20} /> : <Search size={20} />}
        {value && !open && <span aria-hidden="true" className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[var(--brand,#2563eb)]" />}
      </button>
      {open && (
        <div className={`absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border p-3 shadow-xl motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-2 bg-white border-slate-100 dark:bg-slate-800 dark:border-slate-700`}>
          <div className={`flex items-center gap-2 rounded-full border px-4 py-2.5 transition-all focus-within:ring-2 focus-within:ring-[var(--brand-ring,rgba(6,182,212,0.5))] bg-white border-slate-200 text-slate-900 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100`}>
            <Search size={16} className="text-slate-400 dark:text-slate-500" aria-hidden="true" />
            <input type="search" autoFocus autoComplete="off" value={value} onChange={event => onChange(event.target.value)} placeholder={ui('Search bookmarks')} aria-label={ui('Search bookmarks')}
              className="min-w-0 flex-1 bg-transparent font-sans text-sm outline-none placeholder:text-slate-400 [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none" />
            {value && <button type="button" onClick={() => onChange('')} aria-label={ui('Clear search')}
              className={`-my-1 -mr-2 grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300`}><X size={14} /></button>}
          </div>
        </div>
      )}
    </div>
  );
}

