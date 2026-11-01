import { useEffect } from 'react';
import { useRouteError } from 'react-router';
import { FeedState, feedStateButton } from './feed/FeedState';
import { isStaleBuildError, reloadForNewBuild } from '../lib/staleBuild';

/** Shown when a page fails to load or crashes. A page opened before a deploy gets one automatic
 * reload; anything else gets a calm message and a button, never the framework's default screen. */
export function RouteError() {
  const error = useRouteError();
  const stale = isStaleBuildError(error);
  useEffect(() => { if (stale) reloadForNewBuild(); }, [stale]);
  const zh = typeof document !== 'undefined' && document.documentElement.lang.startsWith('zh');
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[var(--page-bg)]">
      <FeedState
        tone="error"
        title={stale ? (zh ? '網站剛更新' : 'NewsAgg was just updated') : (zh ? '此頁面無法顯示' : 'This page could not be shown')}
        body={stale ? (zh ? '請重新載入以取得最新版本。' : 'Reload to get the latest version.') : (zh ? '發生錯誤，請重新載入或回到首頁。' : 'Something went wrong. Reload, or go back to the home page.')}
        action={<button type="button" onClick={() => window.location.reload()} className={feedStateButton}>{zh ? '重新載入' : 'Reload'}</button>}
      />
    </div>
  );
}
