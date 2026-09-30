import { useUiText } from '../i18n/uiText';
import { ListSkeleton } from '../components/ui/ContentSkeleton';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { MessageSquareQuote } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { usePosts } from '../hooks/usePosts';
import { PostComposer } from '../components/posts/PostComposer';
import { PostCard } from '../components/posts/PostCard';
import { PostCategoryPicker } from '../components/posts/PostCategoryPicker';

/** Full posts feed (/posts): composer on top for signed-in users, infinite
 * list below. Supports ?compose=1&attach=<articleId> from "Quote this". */
export function PostsPage() {
  const ui = useUiText();
  const { t, isDark, isAuthenticated, setSidebarOpen } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState<'latest' | 'popular'>('latest');

  const compose = searchParams.get('compose') === '1';
  const attachId = searchParams.get('attach') ?? undefined;

  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = usePosts({ sort, category });
  const posts = data?.pages.flatMap((p) => p.posts) ?? [];

  useEffect(() => {
    if (!hasNextPage) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) fetchNextPage();
      },
      { rootMargin: '200px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, posts.length]);

  const clearAttach = () => setSearchParams({}, { replace: true });

  return (
    <div className="px-4 md:px-6 py-6 space-y-4">
      <h1
        className={`font-poppins text-2xl font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}
      >
        {t.posts}
      </h1>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div role="group" aria-label={ui('Sort posts')} className={`inline-flex rounded-xl border p-1 ${isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-slate-100'}`}>
            {(['latest', 'popular'] as const).map(option => <button key={option} type="button" aria-pressed={sort === option} onClick={() => setSort(option)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${sort === option ? isDark ? 'bg-slate-700 text-white shadow-sm' : 'bg-white text-slate-900 shadow-sm' : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}>{ui(option === 'latest' ? 'Newest first' : 'Most popular')}</button>)}
          </div>
          <button type="button" onClick={() => refetch()} className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">{ui('Refresh')}</button>
        </div>
        <PostCategoryPicker value={category === 'all' ? '' : category} onChange={value => setCategory(value || 'all')} allLabel={ui('All categories')} isDark={isDark} ariaLabel={ui('Filter posts by category')} />
      </div>

      {isAuthenticated ? (
        <PostComposer attachId={attachId} onAttachClear={clearAttach} autoFocus={compose} />
      ) : (
        <button
          onClick={() => setSidebarOpen(true)}
          className={`w-full flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm text-left transition-colors ${
            isDark
              ? 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'
              : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
          }`}
        >
          <MessageSquareQuote size={16} className="shrink-0 text-[var(--brand,#2563eb)]" />
          {t.signInToPost}
        </button>
      )}

      {isLoading && <ListSkeleton label={t.loading} />}

      {isError && <div role="alert" className="rounded-xl border border-rose-300 p-4 text-rose-500">{ui("Could not load posts.")} <button onClick={()=>refetch()} className="underline">{ui("Retry")}</button></div>}

      {!isLoading && !isError && posts.length === 0 && (
        <div
          className={`text-center py-16 rounded-2xl border ${isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500'}`}
        >
          <MessageSquareQuote size={40} className="mx-auto mb-3 opacity-50" />
          <p className="text-sm">{t.noPostsYet}</p>
        </div>
      )}

      <div className="space-y-3">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>

      {hasNextPage && (
        <div ref={sentinelRef} className="min-h-4">
          {isFetchingNextPage && <ListSkeleton count={2} label={t.loading} />}
        </div>
      )}
    </div>
  );
}
