/** A tab opened before a deploy still points at the old build's files, which no longer exist, so
 * opening a not-yet-visited page fails with "Failed to fetch dynamically imported module".
 * One reload fetches the new build. The timestamp stops a loop if the edge briefly serves the old
 * shell again (the HTML is cached for up to a minute); after that the error page offers a button. */
const KEY = 'newsagg-stale-reload';
const WINDOW_MS = 30_000;

export function isStaleBuildError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i.test(message);
}

/** Reloads once per WINDOW_MS. Returns whether a reload was started. */
export function reloadForNewBuild(now = Date.now()): boolean {
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (now - last < WINDOW_MS) return false;
    sessionStorage.setItem(KEY, String(now));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

export function installStaleBuildGuard() {
  // Vite fires this when a lazy chunk or its CSS cannot be loaded.
  window.addEventListener('vite:preloadError', (event) => {
    if (reloadForNewBuild()) event.preventDefault();
  });
}
