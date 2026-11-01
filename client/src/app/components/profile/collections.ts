import { useUiText } from '../../i18n/uiText';

/** The collections every reader starts with (the server holds each reader's
 * edited list). Stored in English and translated on display, so a preset
 * reads the same in either language. */
const DEFAULT_COLLECTIONS: readonly string[] = ['Read later', 'Research', 'Follow this story', 'Share', 'Reference'];

export function useCollectionLabel() {
  const ui = useUiText();
  return (name: string) => DEFAULT_COLLECTIONS.includes(name) ? ui(name) : name;
}

/** The reader's own list in its order, then any other collection still in use. */
export function collectionChoices(meta?: { presets?: string[]; collections?: string[] }) {
  const listed = meta?.presets ?? [...DEFAULT_COLLECTIONS];
  const seen = new Set(listed.map(name => name.toLowerCase()));
  return [...listed, ...(meta?.collections ?? []).filter(name => name && !seen.has(name.toLowerCase()))];
}

/** Trim and collapse spaces, then reuse the spelling of a matching existing
 * or preset collection, so "research " lands in "Research". */
export function normalizeCollection(raw: string, known: string[]) {
  const name = raw.replace(/\s+/g, ' ').trim().slice(0, 60);
  return known.find(k => k.toLowerCase() === name.toLowerCase()) ?? name;
}
