import { useEffect, useId, useRef, useState } from 'react';
import { FolderCog, Pencil, Plus, Trash2 } from 'lucide-react';
import { useBookmarkActions, type BookmarkMeta } from '../../hooks/useBookmarks';
import { useUiText } from '../../i18n/uiText';
import { StyledSelect } from '../ui/StyledSelect';
import { CollectionNameInput } from './CollectionPicker';
import { collectionChoices, normalizeCollection, useCollectionLabel } from './collections';

// Postgres text cannot hold NUL, so this can never collide with a real name.
const DELETE_BOOKMARKS = '\u0000delete';

/** Rename, delete and add collections, presets included. The first one in
 * the list is where new bookmarks go. */
export function ManageCollections({ meta, isDark, onRenamed, onDeleted, id, className = '' }: {
  meta?: BookmarkMeta; isDark: boolean; id?: string; className?: string;
  onRenamed: (from: string, to: string) => void;
  onDeleted: (name: string) => void;
}) {
  const ui = useUiText();
  const labelFor = useCollectionLabel();
  const { renameCollection, createCollection, deleteCollection } = useBookmarkActions();
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [moveTo, setMoveTo] = useState('');
  const [adding, setAdding] = useState(false);
  const names = collectionChoices(meta);
  const counts = meta?.collection_counts ?? {};
  const row = `flex min-h-12 items-center gap-2 rounded-xl px-3 py-1.5 bg-slate-50 dark:bg-slate-800/60`;
  const iconButton = `rounded-lg p-2 transition-colors text-slate-500 hover:bg-white hover:text-blue-600 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100`;

  const startDelete = (name: string) => {
    setEditing(null);
    setDeleting(name);
    setMoveTo(names.find(other => other !== name) ?? DELETE_BOOKMARKS);
  };

  return (
    <section id={id} aria-label={ui('Manage collections')} className={`rounded-2xl border p-3 border-slate-200 dark:border-slate-800 ${className}`}>
      <ul className="space-y-1.5">
        {names.map((name, index) => {
          const count = counts[name] ?? 0;
          if (editing === name) return (
            <li key={name} className={row}>
              <div className="min-w-0 flex-1">
                <CollectionNameInput initial={labelFor(name)} label={`${ui('Rename collection')}: ${labelFor(name)}`} isDark={isDark} onCancel={() => setEditing(null)} onSubmit={raw => {
                  setEditing(null);
                  if (raw.trim() === labelFor(name)) return;
                  const to = normalizeCollection(raw, names.filter(other => other !== name));
                  if (to && to !== name) renameCollection.mutate({ from: name, to }, { onSuccess: ({ name: saved }) => onRenamed(name, saved) });
                }} />
              </div>
            </li>
          );
          if (deleting === name) return (
            <li key={name} className={`${row} flex-wrap`}>
              <p className="w-full pt-1 text-sm font-medium">{ui('Delete collection')}: {labelFor(name)}</p>
              {count > 0 && (
                <div className="min-w-0 flex-1 basis-56">
                  <StyledSelect label={ui('What happens to its bookmarks')} value={moveTo} onChange={setMoveTo} isDark={isDark} className="min-h-9 py-1.5 text-xs" options={[
                    ...names.filter(other => other !== name).map(other => ({ value: other, label: `${ui('Move bookmarks to')} ${labelFor(other)}` })),
                    { value: DELETE_BOOKMARKS, label: `${ui('Delete its bookmarks too')} (${count})` },
                  ]} />
                </div>
              )}
              <div className="ml-auto flex gap-1">
                <button onClick={() => setDeleting(null)} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700">{ui('Cancel')}</button>
                <button onClick={() => {
                  setDeleting(null);
                  const target = count > 0 && moveTo !== DELETE_BOOKMARKS ? moveTo : null;
                  deleteCollection.mutate({ name, moveTo: target }, { onSuccess: () => onDeleted(name) });
                }} className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700">{ui('Delete')}</button>
              </div>
            </li>
          );
          return (
            <li key={name} className={row}>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{labelFor(name)}</span>
              {index === 0 && <span className="shrink-0 rounded-full bg-[color-mix(in_srgb,var(--brand)_14%,transparent)] px-2 py-0.5 text-[11px] font-semibold text-[var(--brand)]">{ui('New bookmarks go here')}</span>}
              <span className={`shrink-0 text-xs tabular-nums text-slate-500 dark:text-slate-400`}>{count}</span>
              <button title={ui('Rename collection')} aria-label={`${ui('Rename collection')}: ${labelFor(name)}`} onClick={() => { setDeleting(null); setEditing(name); }} className={iconButton}><Pencil size={16} /></button>
              <button title={ui('Delete collection')} aria-label={`${ui('Delete collection')}: ${labelFor(name)}`} onClick={() => startDelete(name)} className={`${iconButton} hover:!text-red-600`}><Trash2 size={16} /></button>
            </li>
          );
        })}
      </ul>
      <div className="mt-2">
        {adding ? (
          <CollectionNameInput label={ui('New collection…')} isDark={isDark} onCancel={() => setAdding(false)} onSubmit={raw => {
            setAdding(false);
            const name = normalizeCollection(raw, names);
            if (name) createCollection.mutate(name);
          }} />
        ) : (
          <button onClick={() => setAdding(true)} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-[var(--brand)] hover:bg-[color-mix(in_srgb,var(--brand)_10%,transparent)]">
            <Plus size={16} aria-hidden="true" />{ui('Add collection')}
          </button>
        )}
      </div>
    </section>
  );
}

type ManageProps = Omit<Parameters<typeof ManageCollections>[0], 'id' | 'className'>;

/** "Manage collections" link under the collection filter that drops the
 * manager down beneath it. Closes on Escape or a click outside; clicks in a
 * select menu opened from inside it (portalled to body) don't count. */
export function ManageCollectionsMenu({ buttonClassName, ...props }: ManageProps & { buttonClassName: (open: boolean) => string }) {
  const ui = useUiText();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    rootRef.current?.querySelector<HTMLElement>(`[id="${panelId}"] button`)?.focus();
    const close = () => { setOpen(false); triggerRef.current?.focus(); };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element;
      if (rootRef.current?.contains(target) || target.closest('[role="listbox"], [data-radix-popper-content-wrapper]')) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || (event.target instanceof Element && event.target.closest('[role="listbox"]'))) return;
      close();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('pointerdown', onPointerDown); document.removeEventListener('keydown', onKeyDown); };
  }, [open, panelId]);

  return (
    <div ref={rootRef} className="shrink-0">
      <button ref={triggerRef} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(value => !value)} title={ui('Manage collections')}
        className={buttonClassName(open)}>
        <FolderCog size={20} aria-hidden="true" /><span className="sr-only">{ui('Manage collections')}</span>
      </button>
      {open && (
        <ManageCollections {...props} id={panelId}
          className={`absolute right-0 top-full z-30 mt-2 max-h-[70vh] w-[min(28rem,calc(100vw-2rem))] overflow-y-auto shadow-xl motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 ${props.isDark ? 'bg-slate-900' : 'bg-white'}`} />
      )}
    </div>
  );
}
