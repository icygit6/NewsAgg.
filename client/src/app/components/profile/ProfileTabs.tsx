import { ListSkeleton } from '../ui/ContentSkeleton';
import { useUiText } from '../../i18n/uiText';
import { useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { POSTS_ENABLED } from '../../constants';
import { usePosts } from '../../hooks/usePosts';
import { PostCard } from '../posts/PostCard';
import { BookmarkList } from './BookmarkList';

interface ProfileTabsProps {
  isDark: boolean;
}

type TabKey = 'posts' | 'bookmarks';

/** [My Posts | Bookmarks] tabs on /profile. My Posts lights up with the F7
 * posts feature flag; until then Bookmarks is the only (default) tab. */
export function ProfileTabs({ isDark }: ProfileTabsProps) {
  const ui = useUiText();
  const { t } = useApp();
  const [tab, setTab] = useState<TabKey>(POSTS_ENABLED ? 'posts' : 'bookmarks');
  const { data: mineData, isLoading: mineLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = usePosts({ mine: true, pageSize: 20, enabled: POSTS_ENABLED });
  const myPosts = mineData?.pages.flatMap((p) => p.posts) ?? [];

  const tabs: { key: TabKey; label: string }[] = [
    ...(POSTS_ENABLED ? [{ key: 'posts' as TabKey, label: t.myPosts }] : []),
    { key: 'bookmarks', label: t.bookmarks },
  ];

  const moveTab = (key: TabKey, direction: -1 | 1) => {
    const index = tabs.findIndex((item) => item.key === key);
    const next = tabs[(index + direction + tabs.length) % tabs.length].key;
    setTab(next);
    requestAnimationFrame(() => document.getElementById(`profile-tab-${next}`)?.focus());
  };

  return (
    <div>
      <div
        className={`flex gap-1 rounded-xl p-1 mb-4 ${isDark ? 'bg-slate-950/60' : 'bg-slate-100'}`}
        role="tablist"
      >
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            role="tab"
            id={`profile-tab-${key}`}
            aria-controls={`profile-panel-${key}`}
            aria-selected={tab === key}
            tabIndex={tab === key ? 0 : -1}
            onClick={() => setTab(key)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft') { event.preventDefault(); moveTab(key, -1); }
              if (event.key === 'ArrowRight') { event.preventDefault(); moveTab(key, 1); }
            }}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-colors ${
              tab === key
                ? 'text-white'
                : isDark
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-500 hover:text-slate-800'
            }`}
            style={tab === key ? { background: 'var(--brand-grad, #2563eb)' } : undefined}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'bookmarks' && <div role="tabpanel" id="profile-panel-bookmarks" aria-labelledby="profile-tab-bookmarks"><BookmarkList compact /></div>}
      {tab === 'posts' &&
        POSTS_ENABLED &&
        <div role="tabpanel" id="profile-panel-posts" aria-labelledby="profile-tab-posts">{mineLoading ? (
          <ListSkeleton label={t.loading} />
        ) : myPosts.length === 0 ? (
          <p className={`text-sm py-8 text-center ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
            {t.noPostsYet}
          </p>
        ) : (
          <div className="space-y-3">
            {myPosts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
            {hasNextPage && <button type="button" onClick={() => fetchNextPage()} disabled={isFetchingNextPage} className="w-full rounded-xl border py-2 text-sm">{ui(isFetchingNextPage ? 'Loading…' : 'Load more posts')}</button>}
          </div>
        )}</div>}
    </div>
  );
}
