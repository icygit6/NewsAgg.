import { Link } from 'react-router';
import { MessageSquareQuote } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { useUiText } from '../../i18n/uiText';
import { usePosts } from '../../hooks/usePosts';
import { PostCard } from '../posts/PostCard';
import { ListSkeleton } from '../ui/ContentSkeleton';
import { InfiniteScrollFooter } from '../ui/InfiniteScrollFooter';
import { LoadError } from '../ui/ErrorNote';

/** Reader quotes are attached by article ID, independent of the feed's category. */
export function ArticleQuotes({ articleId }: { articleId: string }) {
  const ui = useUiText();
  const { t } = useApp();
  const { data, isPending, isError, refetch, hasNextPage, fetchNextPage, isFetchingNextPage, isFetchNextPageError } = usePosts({ articleId });
  const posts = [...new Map((data?.pages.flatMap(page => page.posts) ?? []).map(post => [post.id, post])).values()];

  return (
    <section aria-labelledby="article-quotes-heading" className="mt-8 space-y-4">
      <h2 id="article-quotes-heading" className="flex items-center gap-2 text-lg font-semibold">
        <MessageSquareQuote size={20} className="shrink-0 text-[var(--brand)]" />
        {ui('Quotes about this article')}
      </h2>
      {isPending && <ListSkeleton count={2} label={t.loading} />}
      {isError && <LoadError message={ui('Could not load quotes.')} onRetry={() => void refetch()} />}
      {!isPending && !isError && posts.length === 0 && (
        <p className="py-4 text-sm text-slate-600 dark:text-slate-300">
          {ui('No quotes for this article yet.')}{' '}
          <Link to={`/posts?compose=1&attach=${encodeURIComponent(articleId)}`} className="font-semibold text-[var(--brand)] hover:underline">{ui('Be the first to quote it')}</Link>
        </p>
      )}
      {posts.map(post => <PostCard key={post.id} post={post} hideArticlePreview />)}
      <InfiniteScrollFooter hasNextPage={hasNextPage} isFetchingNextPage={isFetchingNextPage} isError={isFetchNextPageError} fetchNextPage={fetchNextPage} />
    </section>
  );
}
