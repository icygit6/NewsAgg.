import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { useUiText } from '../../i18n/uiText';
import { StyledSelect } from '../ui/StyledSelect';
import { normalizeCollection, useCollectionLabel } from './collections';

// Postgres text cannot hold NUL, so this can never collide with a real name.
const NEW = '\u0000new';

export function CollectionNameInput({ initial = '', label, onSubmit, onCancel }: {
  initial?: string; label: string; isDark: boolean;
  onSubmit: (name: string) => void; onCancel: () => void;
}) {
  const ui = useUiText();
  const [draft, setDraft] = useState(initial);
  const submit = () => { if (draft.trim()) onSubmit(draft); else onCancel(); };
  return (
    <form className="flex min-w-0 items-center gap-1" onSubmit={event => { event.preventDefault(); submit(); }}>
      <input
        autoFocus aria-label={label} placeholder={ui('Collection name')} value={draft} maxLength={60}
        onChange={event => setDraft(event.target.value)}
        onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onCancel(); } }}
        className={`min-h-11 min-w-0 flex-1 rounded-xl border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)] border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100`}
      />
      <button type="submit" aria-label={ui('Save')} className="rounded-lg p-2 text-[var(--brand)] hover:bg-[color-mix(in_srgb,var(--brand)_10%,transparent)]"><Check size={16} /></button>
      <button type="button" aria-label={ui('Cancel')} onClick={onCancel} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={16} /></button>
    </form>
  );
}

/** Pick an existing or preset collection, or type a new one. As a chip the
 * new-name field can't fit inline, so the caller shows it via onNew. */
export function CollectionPicker({ value, choices: known, onChange, label, isDark, chip = false, onNew }: {
  value: string; choices: string[]; label: string; isDark: boolean;
  onChange: (name: string) => void;
  chip?: boolean; onNew?: () => void;
}) {
  const ui = useUiText();
  const labelFor = useCollectionLabel();
  const [creating, setCreating] = useState(false);
  const choices = known.includes(value) ? known : [value, ...known];

  if (creating) return <CollectionNameInput label={label} isDark={isDark} onCancel={() => setCreating(false)} onSubmit={raw => {
    setCreating(false);
    const name = normalizeCollection(raw, choices);
    if (name && name !== value) onChange(name);
  }} />;

  return (
    <StyledSelect
      label={label} value={value} isDark={isDark}
      variant={chip ? 'chip' : 'field'}
      className={chip ? 'bg-blue-500/10 text-blue-700 hover:bg-blue-500/20 dark:text-blue-300' : 'min-h-9 py-1.5 text-xs'}
      onChange={next => { if (next === NEW) { if (onNew) onNew(); else setCreating(true); } else if (next !== value) onChange(next); }}
      options={[...choices.map(name => ({ value: name, label: labelFor(name) })), { value: NEW, label: `+ ${ui('New collection…')}` }]}
    />
  );
}
