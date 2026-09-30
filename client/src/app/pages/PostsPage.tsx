import { useUiText } from '../i18n/uiText';
import { ListSkeleton } from '../components/ui/ContentSkeleton';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { MessageSquareQuote } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { usePosts } from '../hooks/usePosts';
import { PostComposer } from '../components/posts/PostComposer';
import { PostCard } from '../components/posts/PostCard';

/** Full posts feed (/posts): composer on top for signed-in users, infinite
 * list below. Supports ?compose=1&attach=<articleId> from "Quote this". */
export function PostsPage() {
  const ui = useUiText();
  const { t, isDark, isAuthenticated, setSidebarOpen } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [category, setCategory] = useState('all');

  const compose = searchParams.get('compose') === '1';
  const attachId = searchParams.get('attach') ?? undefined;

  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = usePosts({ sort: 'latest', category });
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
      <div className="flex gap-2 items-center">
        <span className="text-sm">{ui("Newest first")}</span>
        <select aria-label={ui("Filter posts by category")} value={category} onChange={e => setCategory(e.target.value)} className="rounded-lg border p-2 text-sm bg-transparent">
          <option value="all">{ui("All categories")}</option>
          {['General','Sport','Health','Business','World','Politics','Lifestyle','Science','Climate'].map(c => <option key={c} value={c}>{ui(c)}</option>)}
        </select>
        <button onClick={()=>refetch()} className="ml-auto text-sm text-cyan-500">{ui("Refresh")}</button>
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
