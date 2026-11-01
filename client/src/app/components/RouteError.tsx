import { useUiText } from '../i18n/uiText';
import { useEffect } from 'react';
import { useRouteError } from 'react-router';
import { FeedState } from './feed/FeedState';
import { feedStateButton } from './feed/feedStateButton';
import { isStaleBuildError, reloadForNewBuild } from '../lib/staleBuild';

/** Shown when a page fails to load or crashes. A page opened before a deploy gets one automatic
 * reload; anything else gets a calm message and a button, never the framework's default screen. */
export function RouteError() {
  const ui = useUiText();
  const error = useRouteError();
  const stale = isStaleBuildError(error);
  useEffect(() => { if (stale) reloadForNewBuild(); }, [stale]);
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[var(--page-bg)]">
      <FeedState
        tone="error"
        title={stale ? (ui('NewsAgg was just updated')) : (ui('This page could not be shown'))}
        body={stale ? (ui('Reload to get the latest version.')) : (ui('Something went wrong. Reload, or go back to the home page.'))}
        action={<button type="button" onClick={() => window.location.reload()} className={feedStateButton}>{ui('Reload')}</button>}
      />
    </div>
  );
}
