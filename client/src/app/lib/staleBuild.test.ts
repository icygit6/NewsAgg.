import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { isStaleBuildError, reloadForNewBuild } from './staleBuild';

const reload = vi.fn();
beforeEach(() => {
  sessionStorage.clear();
  reload.mockReset();
  vi.stubGlobal('location', { ...window.location, reload });
});
afterEach(() => vi.unstubAllGlobals());

it('recognises the failures a deploy causes in an open tab, and nothing else', () => {
  expect(isStaleBuildError(new TypeError('Failed to fetch dynamically imported module: https://x/assets/BookmarksPage-abc.js'))).toBe(true);
  expect(isStaleBuildError(new Error('error loading dynamically imported module'))).toBe(true);
  expect(isStaleBuildError(new Error('Importing a module script failed.'))).toBe(true);
  expect(isStaleBuildError(new Error('Cannot read properties of undefined'))).toBe(false);
  expect(isStaleBuildError(undefined)).toBe(false);
});

it('reloads once, then refuses for thirty seconds so it cannot loop', () => {
  expect(reloadForNewBuild(1_000_000)).toBe(true);
  expect(reloadForNewBuild(1_010_000)).toBe(false);
  expect(reload).toHaveBeenCalledTimes(1);
  expect(reloadForNewBuild(1_031_000)).toBe(true);
  expect(reload).toHaveBeenCalledTimes(2);
});
