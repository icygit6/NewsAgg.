import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { PenSquare } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useApp } from '../../contexts/AppContext';
import { CATEGORY_BADGE_CLASS, CATEGORY_LABELS, POSTS_ENABLED } from '../../constants';
import { useUiText } from '../../i18n/uiText';
import { fetchDailyQuote, fetchQuoteList } from '../../services/quoteService';
import { usePosts } from '../../hooks/usePosts';
import { QuoteCard } from './QuoteCard';
import { PostCard } from './PostCard';

const RAIL_QUOTES = 8;
const RAIL_POSTS = 12;

/** "Posts beside the news": quote of the day pinned on top, then a feed that
 * interleaves user posts with FavQs quotes (every 5th slot is a quote). With
 * no posts yet the feed degrades to a quotes-only list. */
export function PulseRail() {
  const ui = useUiText();
  const { t, isAuthenticated, setSidebarOpen, selectedCategory, setSelectedCategory } = useApp();
  // Pulse follows the site-wide category like the feed and Insights do. Post
  // categories are stored by label ("Sport"), the filter by key ("sport").
  const categoryLabel = selectedCategory === 'all' ? null : CATEGORY_LABELS[selectedCategory];

  const { data: daily } = useQuery({
    queryKey: ['quote', 'daily'],
    queryFn: fetchDailyQuote,
    staleTime: 60 * 60 * 1000,
  });
  const { data: quoteList = [] } = useQuery({
    queryKey: ['quote', 'list'],
    queryFn: fetchQuoteList,
    staleTime: 60 * 60 * 1000,
  });
  const { data: postsData, isPending: postsPending } = usePosts({ pageSize: RAIL_POSTS, category: categoryLabel ?? 'all' });
  const railPosts = POSTS_ENABLED ? (postsData?.pages[0]?.posts ?? []) : [];
  const postCards: ReactNode[] = railPosts.map((post) => (
    <PostCard key={`p-${post.id}`} post={post} />
  ));

  // Deterministic interleave: after every 4 posts comes 1 quote, drawn
  // round-robin from the daily batch. With no posts yet the feed degrades to
  // a clean quotes-only list.
  const items: ReactNode[] = [];
  if (postCards.length > 0) {
    let quoteIdx = 0;
    let postIdx = 0;
    const total = postCards.length + Math.ceil(postCards.length / 4);
    for (let i = 0; i < total; i += 1) {
      if (i % 5 === 4 && quoteList.length > 0) {
        const q = quoteList[quoteIdx % quoteList.length];
        items.push(<QuoteCard key={`q-${i}`} quote={q} />);
        quoteIdx += 1;
      } else if (postIdx < postCards.length) {
        items.push(postCards[postIdx]);
        postIdx += 1;
      }
    }
  } else if (!categoryLabel) {
    quoteList.slice(0, RAIL_QUOTES).forEach((q, i) => {
      items.push(<QuoteCard key={`q-${i}`} quote={q} />);
    });
  }

  const teaserClasses = `w-full flex items-center gap-3 rounded-full border px-4 py-2.5 text-sm text-left transition-colors bg-white border-slate-200 text-slate-400 hover:border-slate-300 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-500 dark:hover:border-slate-600`;

  return (
    <div className="flex flex-col gap-3">
      {categoryLabel && selectedCategory !== 'all' && (
        <div className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300`}>
          <span className="flex items-center gap-2">
            {ui('Showing')}
            <span className={`rounded-full px-2 py-0.5 font-semibold ${CATEGORY_BADGE_CLASS[selectedCategory]}`}>{ui(categoryLabel)}</span>
          </span>
          <button type="button" onClick={() => setSelectedCategory('all')} className="min-h-8 rounded-lg px-2 text-xs font-semibold text-[var(--brand,#2563eb)] hover:text-[var(--brand-hover)]">
            {t.allCategories}
          </button>
        </div>
      )}

      {daily && <QuoteCard quote={daily} pinned />}

      {POSTS_ENABLED ? (
        isAuthenticated ? (
          <Link to="/posts?compose=1" className={teaserClasses}>
            <PenSquare size={16} className="shrink-0 text-[var(--brand,#2563eb)] hover:text-[var(--brand-hover)]" />
            {t.whatsHappening}
          </Link>
        ) : (
          <button onClick={() => setSidebarOpen(true)} className={teaserClasses}>
            <PenSquare size={16} className="shrink-0 text-[var(--brand,#2563eb)] hover:text-[var(--brand-hover)]" />
            {t.signInToPost}
          </button>
        )
      ) : (
        <div className={`${teaserClasses} cursor-default opacity-70`}>
          <PenSquare size={16} className="shrink-0" />
          {t.postsComingSoon}
        </div>
      )}

      {items}

      {POSTS_ENABLED && categoryLabel && !postsPending && postCards.length === 0 && (
        <p className={`rounded-xl border border-dashed px-4 py-6 text-center text-sm border-slate-300 text-slate-500 dark:border-slate-700 dark:text-slate-400`}>
          {ui('No posts in this category yet.')}
        </p>
      )}

      {POSTS_ENABLED && (
        <Link
          to="/posts"
          className="text-sm font-medium px-2 py-1 text-[var(--brand,#2563eb)] hover:text-[var(--brand-hover)]"
        >
          {t.viewAllPosts}
        </Link>
      )}
    </div>
  );
}
