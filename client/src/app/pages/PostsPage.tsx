import { segment } from '../components/ui/styles';
import { useUiText } from '../i18n/uiText';
import { ListSkeleton } from '../components/ui/ContentSkeleton';
import { InfiniteScrollFooter } from '../components/ui/InfiniteScrollFooter';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { MessageSquareQuote } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { usePosts } from '../hooks/usePosts';
import { PostComposer } from '../components/posts/PostComposer';
import { PostCard } from '../components/posts/PostCard';
import { PostCategorySelect } from '../components/posts/PostCategorySelect';
import { FeedState } from '../components/feed/FeedState';
import { feedStateButton } from '../components/feed/feedStateButton';

/** Full posts feed (/posts): composer on top for signed-in users, infinite
 * list below. Supports ?compose=1&attach=<articleId> from "Quote this". */
export function PostsPage() {
  const ui = useUiText();
  const { t, isAuthenticated, setSidebarOpen } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState<'latest' | 'oldest' | 'popular'>('latest');

  const compose = searchParams.get('compose') === '1';
  const attachId = searchParams.get('attach') ?? undefined;

  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage, isFetchNextPageError } = usePosts({ sort, category, live: true });
  const posts = data?.pages.flatMap((p) => p.posts) ?? [];

  const clearAttach = () => setSearchParams({}, { replace: true });

  return (
    <div className="px-4 md:px-6 py-6 space-y-4">
      <h1
        className={`font-poppins text-2xl font-bold text-slate-900 dark:text-slate-100`}
      >
        {t.posts}
      </h1>
      <div className="flex items-center justify-between gap-2">
          <div role="group" aria-label={ui('Sort posts')} className={`${segment.track} min-w-0 max-sm:gap-0.5`}>
            {(['latest', 'oldest', 'popular'] as const).map(option => <button key={option} type="button" aria-pressed={sort === option} onClick={() => setSort(option)} className={`whitespace-nowrap max-sm:px-2 ${sort === option ? segment.active : segment.item}`}><span className="hidden sm:inline">{ui(option === 'latest' ? 'Newest first' : option === 'oldest' ? 'Oldest first' : 'Most popular')}</span><span className="sm:hidden">{ui(option === 'latest' ? 'Newest' : option === 'oldest' ? 'Oldest' : 'Popular')}</span></button>)}
          </div>
          <PostCategorySelect variant="filter" value={category === 'all' ? '' : category} onChange={value => setCategory(value || 'all')} label={ui('Filter posts by category')} />
      </div>

      {isAuthenticated ? (
        <PostComposer attachId={attachId} onAttachClear={clearAttach} autoFocus={compose} />
      ) : (
        <button
          onClick={() => setSidebarOpen(true)}
          className={`w-full flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm text-left transition-colors bg-white border-slate-200 text-slate-500 hover:border-slate-300 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600`}
        >
          <MessageSquareQuote size={16} className="shrink-0 text-[var(--brand,#2563eb)]" />
          {t.signInToPost}
        </button>
      )}

      {isLoading && <ListSkeleton label={t.loading} />}

      {isError && <FeedState tone="error" title={t.errorTitle} body={ui("Could not load posts.")} action={<button type="button" onClick={() => void refetch()} className={feedStateButton}>{ui("Try again")}</button>} />}

      {!isLoading && !isError && posts.length === 0 && <FeedState title={t.noPostsYet} />}

      <div className="space-y-3">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>

      <InfiniteScrollFooter hasNextPage={hasNextPage} isFetchingNextPage={isFetchingNextPage} isError={isFetchNextPageError} fetchNextPage={fetchNextPage} loading={<ListSkeleton count={2} label={t.loading} />} />
    </div>
  );
}
