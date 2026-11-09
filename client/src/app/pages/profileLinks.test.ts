import { expect, it } from 'vitest';

// Guard: a username goes into the URL path, where #, ? and / would send the
// link to the wrong place. Every link built from one must encode it.
const sources = import.meta.glob('/src/app/**/*.tsx', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

it('every profile link encodes the username', () => {
  const offenders = Object.entries(sources)
    .filter(([file]) => !/\.test\./.test(file))
    .flatMap(([file, text]) => [...text.matchAll(/\/profile\/\$\{(?!encodeURIComponent\()[^}]*\}/g)].map((m) => `${file}: ${m[0]}`));
  expect(offenders).toEqual([]);
});
