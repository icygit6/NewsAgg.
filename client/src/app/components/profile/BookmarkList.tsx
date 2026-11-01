import { useUiText } from '../../i18n/uiText';
import { useTitleTranslations } from '../../hooks/useTitleTranslations';
import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { Archive, ArchiveRestore, Check, Clock3, ExternalLink, MessageSquareQuote, NotebookPen, RotateCcw, Trash2 } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { ImageWithFallback } from '../utils/ImageWithFallback';
import { InfiniteScrollFooter } from '../ui/InfiniteScrollFooter';
import { useBookmarkActions, useBookmarkList, useBookmarkMeta } from '../../hooks/useBookmarks';
import { CollectionNameInput, CollectionPicker } from './CollectionPicker';
import { collectionChoices, normalizeCollection } from './collections';
import { FeedState } from '../feed/FeedState';
import { feedStateButton } from '../feed/feedStateButton';
import { SourceLogo } from '../ui/SourceLogo';
import { CATEGORY_BADGE_CLASS, CATEGORY_GROUP_HOVER_TEXT, POSTS_ENABLED, TOPIC_TO_CATEGORY, categoryVars } from '../../constants';
import { formatNewsDate } from '../../lib/formatDate';
import type { SentimentType } from '../../types/sentiment';
import { ListSkeleton } from '../ui/ContentSkeleton';

export type BookmarkStatus = 'unread' | 'read' | 'archived';
const statusOf = (b: { is_read: boolean; archived: boolean }): BookmarkStatus => b.archived ? 'archived' : b.is_read ? 'read' : 'unread';
const pillTone: Record<BookmarkStatus, string> = {
  unread: 'bg-[color-mix(in_srgb,var(--brand)_14%,transparent)] text-[var(--brand)]',
  read: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
  archived: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
};

export function StatusPill({ status }: { status: BookmarkStatus }) {
  const ui = useUiText();
  return <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 font-semibold ${pillTone[status]}`}>
    {status === 'unread' && <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />}
    {ui({ unread: 'Unread', read: 'Read', archived: 'Archived' }[status])}
  </span>;
}

export function BookmarkList({ filters={} }: { filters?:Record<string,string> }) {
  const ui = useUiText();
  const { t } = useApp();
  const q=useBookmarkList(filters); const {remove,restore}=useBookmarkActions(); const meta=useBookmarkMeta();
  const [removed,setRemoved]=useState<number|null>(null); const items=q.data?.pages.flatMap((p:any)=>p.bookmarks)??[];
  const titles = useTitleTranslations(items.map((b:any) => ({ id: String(b.article_id), title: b.article_title || '', language: b.article_language })));
  if(q.isLoading) return <ListSkeleton label={ui("Loading bookmarks…")} />;
  if(q.isError) return <FeedState tone="error" title={t.errorTitle} body={ui("Could not load bookmarks.")} action={<button type="button" onClick={()=>void q.refetch()} className={feedStateButton}>{ui("Try again")}</button>} />;
  if(!items.length) return <FeedState title={ui("No matching bookmarks")} body={ui("Save a story with the bookmark button and it waits for you here.")} action={<Link to="/" className={feedStateButton}>{ui("Explore articles")}</Link>} />;
  return <>
    {removed!==null&&<div role="status" className="mb-3 p-3 rounded-xl bg-blue-500/10 flex justify-between">{ui("Bookmark removed")}<button className="font-semibold text-blue-600 dark:text-blue-400" onClick={()=>restore.mutate(removed,{onSuccess:()=>setRemoved(null)})}><RotateCcw size={14} className="inline"/> {ui("Undo")}</button></div>}
    <div className="grid min-w-0 grid-cols-2 items-stretch gap-3 lg:grid-cols-3 lg:gap-4">{items.map((b:any,index:number)=><BookmarkCard key={b.id} b={b} title={titles[index]?.title} choices={collectionChoices(meta.data)} onRemove={()=>remove.mutate(b.id,{onSuccess:()=>setRemoved(b.id)})}/>)}</div>
    <InfiniteScrollFooter hasNextPage={q.hasNextPage} isFetchingNextPage={q.isFetchingNextPage} isError={q.isFetchNextPageError} fetchNextPage={q.fetchNextPage} />
  </>;
}

const iconBase = 'rounded-lg p-1.5 transition-colors sm:p-2';
const iconButton = `${iconBase} text-slate-500 hover:bg-slate-100 hover:text-blue-600 dark:text-slate-400 dark:hover:bg-slate-800`;
// Matches the home feed card's sentiment pill.
const SENTIMENT_STYLE: Record<SentimentType, { bg: string; dot: string; dark: string }> = {
  positive: { bg: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', dark: 'bg-emerald-900/40 text-emerald-300' },
  neutral: { bg: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500', dark: 'bg-amber-500/20 text-amber-200' },
  negative: { bg: 'bg-red-100 text-red-700', dot: 'bg-red-500', dark: 'bg-red-900/40 text-red-300' },
};

/** One saved story. The collection tag opens the collection picker and the
 * note button opens the note editor, so neither takes room until it's used. */
function BookmarkCard({ b, title, choices, onRemove }: { b: any; title?: string; choices: string[]; onRemove: () => void }) {
  const ui = useUiText();
  const { isDark, t, language } = useApp();
  const { update, archive } = useBookmarkActions();
  const [newCollection, setNewCollection] = useState(false);
  const [editingNote, setEditingNote] = useState(false);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const note: string = b.notes || '';
  const saveNote = (value: string) => { setEditingNote(false); if (value.trim() !== note) update.mutate({ id: b.id, notes: value.trim() }); };

  const category = TOPIC_TO_CATEGORY[b.topic as keyof typeof TOPIC_TO_CATEGORY];
  const sentiment = SENTIMENT_STYLE[b.sentiment as SentimentType] ? b.sentiment as SentimentType : null;
  const headline = title || ui('Untitled article');

  // Same frame as the home feed's NewsCard; the bookmark controls live in the footer.
  return <article data-status={statusOf(b)} className={`group min-w-0 motion-safe:transition-transform motion-safe:duration-200 motion-safe:hover:-translate-y-0.5 ${b.archived ? 'opacity-70' : ''}`}>
    <div style={categoryVars(category) as React.CSSProperties} className={`news-card-frame flex h-full flex-col overflow-hidden rounded-2xl border transition-[border-color,box-shadow] duration-200 ${isDark ? 'bg-slate-900 border-slate-800 hover:border-slate-600' : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-md'}`}>
      {/* The image links to the story; the badges and the post button sit on
          top of it rather than inside the link. */}
      <div className="relative aspect-[16/10] shrink-0 overflow-hidden">
        <Link to={`/article/${b.article_id}`} viewTransition tabIndex={-1} aria-hidden="true" className="block h-full w-full">
          <ImageWithFallback loading="lazy" src={b.url_to_image || ''} alt="" className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-105" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
        </Link>
        <div className="pointer-events-none absolute left-2 right-2 top-2 flex items-start justify-between gap-1 sm:left-3 sm:right-3 sm:top-3 sm:gap-2">
          {b.topic ? <span title={ui(b.topic)} className={`min-w-0 truncate rounded-full px-1.5 py-1 text-[11px] font-semibold sm:px-2.5 sm:text-xs ${CATEGORY_BADGE_CLASS[category] ?? 'bg-slate-600 text-white'}`}>{ui(b.topic)}</span> : <span />}
          {POSTS_ENABLED && <Link to={`/posts?compose=1&attach=${encodeURIComponent(b.article_id)}`} aria-label={t.quoteThis} title={t.quoteThis}
            className="pointer-events-auto inline-flex shrink-0 items-center justify-center rounded-full bg-black/40 p-1.5 text-white backdrop-blur-sm transition-all hover:bg-black/60 sm:p-2">
            <MessageSquareQuote size={16} />
          </Link>}
        </div>
        {sentiment && <span className={`pointer-events-none absolute bottom-2 left-2 flex items-center gap-1 rounded-full px-1.5 py-1 text-[11px] font-semibold sm:bottom-3 sm:left-3 sm:gap-1.5 sm:px-2.5 sm:text-xs ${isDark ? SENTIMENT_STYLE[sentiment].dark : SENTIMENT_STYLE[sentiment].bg}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${SENTIMENT_STYLE[sentiment].dot}`} />{t[sentiment]}
        </span>}
      </div>

      <div className="flex min-w-0 flex-1 flex-col p-2.5 sm:p-3">
        <div className="mb-2 flex min-w-0 items-center gap-2">
          <SourceLogo source={{ name: b.source_name || ui('Unknown') }} isDark={isDark} className="h-7 w-7 shrink-0 sm:h-8 sm:w-8" />
          <div className="min-w-0">
            <p className={`truncate text-xs font-semibold sm:text-sm text-slate-700 dark:text-slate-200`}>{b.source_name || ui('Unknown')}</p>
            <p className={`hidden truncate text-xs sm:block text-slate-500 dark:text-slate-400`}>{ui('Saved')} {formatNewsDate(b.created_at, language)}</p>
          </div>
        </div>

        <Link to={`/article/${b.article_id}`} viewTransition title={headline} className={`news-headline mb-2 line-clamp-3 min-h-[4.2em] font-poppins text-sm font-semibold leading-[1.4] [overflow-wrap:anywhere] transition-colors sm:text-base ${CATEGORY_GROUP_HOVER_TEXT} ${b.is_read ? 'text-slate-500 dark:text-slate-400' : 'text-[#0b1f33] dark:text-slate-100'}`}>{headline}</Link>

        {editingNote
          ? <textarea ref={noteRef} autoFocus aria-label={`${ui('Note')}: ${b.article_title}`} defaultValue={note} placeholder={ui('Add a private note…')} maxLength={1000} rows={3}
              onBlur={e=>saveNote(e.target.value)}
              onKeyDown={e=>{ if(e.key==='Escape'){ e.preventDefault(); setEditingNote(false); } if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){ e.preventDefault(); saveNote(e.currentTarget.value); } }}
              className="mb-2 w-full resize-none rounded-xl border border-slate-200 bg-white p-2.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)] dark:border-slate-700 dark:bg-slate-900"/>
          : note&&<button onClick={()=>setEditingNote(true)} title={ui('Edit note')} className="mb-2 block w-full border-l-2 border-slate-200 pl-2.5 text-left text-xs italic leading-relaxed text-slate-600 line-clamp-2 hover:border-[var(--brand)] dark:border-slate-700 dark:text-slate-300">{note}</button>}

        <div className="flex-1" />

        <div className="mb-2 flex min-w-0 items-center gap-1.5 text-xs">
          <StatusPill status={statusOf(b)}/>
          <CollectionPicker chip label={`${ui('Collection')}: ${b.article_title}`} value={b.collection_name} choices={choices} isDark={isDark} onNew={()=>setNewCollection(true)} onChange={name=>update.mutate({id:b.id,collectionName:name})}/>
        </div>
        {newCollection&&<div className="mb-2"><CollectionNameInput label={`${ui('New collection…')}: ${b.article_title}`} isDark={isDark} onCancel={()=>setNewCollection(false)} onSubmit={raw=>{
          setNewCollection(false);
          const name=normalizeCollection(raw,choices);
          if(name&&name!==b.collection_name)update.mutate({id:b.id,collectionName:name});
        }}/></div>}

        {/* The home feed card's footer; empty when cleanup removed the article. */}
        {(b.reading_time_min != null || b.published_at) && <div className={`flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-t pt-2 text-xs border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400`}>
          {b.reading_time_min != null && <div className="flex min-w-0 items-center gap-1.5">
            <Clock3 size={14} className="flex-shrink-0 opacity-70" />
            <span className="truncate font-medium">{ui(b.reading_time_min > 0 ? `${b.reading_time_min} min` : 'Quick read')}</span>
          </div>}
          {b.published_at && <span className="ml-auto flex-shrink-0 font-medium">{formatNewsDate(b.published_at, language)}</span>}
        </div>}
        <div className={`mt-1 flex min-w-0 items-center text-xs text-slate-500 dark:text-slate-400`}>
          <span className="truncate opacity-80">{b.source_domain || t.source}</span>
        </div>

        <div className={`mt-2 flex items-center justify-between gap-1 border-t pt-2 border-slate-200 dark:border-slate-700`}>
          <button aria-pressed={b.is_read} title={ui(b.is_read?'Mark unread':'Mark read')} aria-label={`${ui(b.is_read?'Mark unread':'Mark read')}: ${b.article_title}`} onClick={()=>update.mutate({id:b.id,isRead:!b.is_read})} className={b.is_read?`${iconBase} bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 dark:text-emerald-400`:iconButton}><Check size={16}/></button>
          <button aria-pressed={b.archived} title={ui(b.archived?'Unarchive':'Archive')} aria-label={`${ui(b.archived?'Unarchive':'Archive')}: ${b.article_title}`} onClick={()=>archive(b)} className={b.archived?`${iconBase} bg-amber-500/15 text-amber-600 hover:bg-amber-500/25 dark:text-amber-400`:iconButton}>{b.archived?<ArchiveRestore size={16}/>:<Archive size={16}/>}</button>
          <button aria-expanded={editingNote} title={ui(note?'Edit note':'Add note')} aria-label={`${ui(note?'Edit note':'Add note')}: ${b.article_title}`} onMouseDown={e=>{ if(editingNote) e.preventDefault(); }} onClick={()=>editingNote?saveNote(noteRef.current?.value??note):setEditingNote(true)} className={note?`${iconBase} text-[var(--brand)] hover:bg-[color-mix(in_srgb,var(--brand)_10%,transparent)]`:iconButton}><NotebookPen size={16}/></button>
          {b.article_url&&<a href={b.article_url} target="_blank" rel="noopener noreferrer" title={ui('Open original article')} aria-label={`Open original article: ${b.article_title}`} className={iconButton}><ExternalLink size={16}/></a>}
          <button title={ui('Remove bookmark')} aria-label={`Remove bookmark: ${b.article_title}`} onClick={onRemove} className={`${iconBase} text-red-500 hover:bg-red-500/10`}><Trash2 size={16}/></button>
        </div>
      </div>
    </div>
  </article>;
}
