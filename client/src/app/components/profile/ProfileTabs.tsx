import { segment } from '../ui/styles';
import { ListSkeleton } from '../ui/ContentSkeleton';
import { InfiniteScrollFooter } from '../ui/InfiniteScrollFooter';
import { useState } from 'react';
import { Link } from 'react-router';
import { PenLine } from 'lucide-react';
import { useUiText } from '../../i18n/uiText';
import { useApp } from '../../contexts/AppContext';
import { POSTS_ENABLED } from '../../constants';
import { usePosts } from '../../hooks/usePosts';
import { PostCard } from '../posts/PostCard';
import { BookmarkCollection } from './BookmarkCollection';

type TabKey = 'posts' | 'bookmarks';

/** [My Posts | Bookmarks] tabs on /profile. My Posts lights up with the F7
 * posts feature flag; until then Bookmarks is the only (default) tab. */
export function ProfileTabs() {
  const ui = useUiText();
  const { t } = useApp();
  const [tab, setTab] = useState<TabKey>(POSTS_ENABLED ? 'posts' : 'bookmarks');
  const { data: mineData, isLoading: mineLoading, hasNextPage, fetchNextPage, isFetchingNextPage, isFetchNextPageError } = usePosts({ mine: true, pageSize: 20, enabled: POSTS_ENABLED });
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
        className={`${segment.track} mb-4 flex w-full`}
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
            className={`flex-1 min-h-9 ${tab === key ? segment.active : segment.item}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'bookmarks' && <div role="tabpanel" id="profile-panel-bookmarks" aria-labelledby="profile-tab-bookmarks"><BookmarkCollection /></div>}
      {tab === 'posts' &&
        POSTS_ENABLED &&
        <div role="tabpanel" id="profile-panel-posts" aria-labelledby="profile-tab-posts">{mineLoading ? (
          <ListSkeleton label={t.loading} />
        ) : myPosts.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className={`text-sm text-slate-500 dark:text-slate-400`}>{t.noPostsYet}</p>
            <Link to="/posts?compose=1" className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--brand-hover)]">
              <PenLine size={14} />{ui("Write a post")}
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {myPosts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
            <InfiniteScrollFooter hasNextPage={hasNextPage} isFetchingNextPage={isFetchingNextPage} isError={isFetchNextPageError} fetchNextPage={fetchNextPage} loading={<ListSkeleton count={2} label={t.loading} />} />
          </div>
        )}</div>}
    </div>
  );
}
