export type DataMode = 'demo' | 'worst' | 'empty' | 'one' | 'many';
export const DATA_MODES: DataMode[] = ['demo', 'worst', 'empty', 'one', 'many'];

/** `?data=worst` and friends, dev builds only. `import.meta.env.DEV` is a
 * compile-time constant, so in the production bundle every call site below
 * folds away and the fixtures are never reached — see usePosts, which imports
 * them dynamically for the same reason. */
export function currentDataMode(): DataMode {
  if (!import.meta.env.DEV || typeof window === 'undefined') return 'demo';
  const value = new URLSearchParams(window.location.search).get('data');
  return (DATA_MODES as string[]).includes(value ?? '') ? (value as DataMode) : 'demo';
}

export function setDataMode(mode: DataMode) {
  const url = new URL(window.location.href);
  if (mode === 'demo') url.searchParams.delete('data');
  else url.searchParams.set('data', mode);
  // A reload rather than a push: the fixture is read where the query runs.
  window.location.href = url.toString();
}
