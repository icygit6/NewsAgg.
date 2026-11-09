import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Bookmark, ExternalLink, Flag, MessageSquareQuote, MoreHorizontal, PlayCircle } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { useBookmarks } from '../../hooks/useBookmarks';
import { useUiText } from '../../i18n/uiText';
import { POSTS_ENABLED } from '../../constants';
import { getArticleId } from '../../services/newsAPI';
import type { NewsArticle } from '../../types/article';
import { button } from '../ui/styles';
import { ReportIssue } from './ReportIssue';

/** Every action on a story in one bar under the title: the publisher link
 * first, then bookmark and quote, with the rarer ones behind "⋯". It scrolls
 * with the story; the end of the story links to the original again. */
export function ArticleActions({ article, isDark }: { article: NewsArticle; isDark: boolean }) {
  const ui = useUiText();
  const { t, isAuthenticated, setSidebarOpen } = useApp();
  const { isBookmarked: isArticleBookmarked, bookmarkIdFor, add, remove } = useBookmarks();
  const articleId = getArticleId(article);
  const isBookmarked = isArticleBookmarked(articleId);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => { if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false); };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') { setMenuOpen(false); menuButtonRef.current?.focus(); } };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('pointerdown', onPointerDown); document.removeEventListener('keydown', onKeyDown); };
  }, [menuOpen]);

  const toggleBookmark = () => {
    if (!isAuthenticated) { setSidebarOpen(true); return; }
    if (isBookmarked) {
      const bookmarkId = bookmarkIdFor(articleId);
      if (bookmarkId) remove.mutate(bookmarkId);
    } else {
      add.mutate(article);
    }
  };
  const startReport = () => {
    setMenuOpen(false);
    // Guests can read but not report; the item opens sign-in instead.
    if (!isAuthenticated) { setSidebarOpen(true); return; }
    setReporting(true);
  };
  const menuItem = 'flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700/60';

  return (
    <div className="mb-6">
      {/* Phone: one row, the publisher link filling it and the rest as 44px icon buttons. */}
      <div className="flex items-center gap-2 sm:flex-wrap">
        <a href={article.url} target="_blank" rel="noopener noreferrer" className={`${button.primary} min-w-0 flex-1 max-sm:min-h-11 max-sm:px-3 sm:flex-none`}>
          <ExternalLink size={16} aria-hidden="true" className="shrink-0" /><span className="truncate">{ui('Read on')} {article.source.name}</span>
        </a>
        <button type="button" onClick={toggleBookmark} disabled={add.isPending || remove.isPending} aria-pressed={isBookmarked}
          aria-label={isBookmarked ? t.bookmarked : t.bookmark} title={isBookmarked ? t.bookmarked : t.bookmark}
          className={`${isBookmarked ? `${button.secondary} !border-amber-500 !bg-amber-500 !text-white hover:!bg-amber-600` : button.secondary} max-sm:size-11 max-sm:shrink-0 max-sm:px-0`}>
          <Bookmark size={16} aria-hidden="true" fill={isBookmarked ? 'currentColor' : 'none'} /><span className="max-sm:sr-only">{isBookmarked ? t.bookmarked : t.bookmark}</span>
        </button>
        {POSTS_ENABLED && (
          <Link to={`/posts?compose=1&attach=${encodeURIComponent(articleId)}`} aria-label={t.quoteThis} title={t.quoteThis} className={`${button.secondary} max-sm:size-11 max-sm:shrink-0 max-sm:px-0`}>
            <MessageSquareQuote size={16} aria-hidden="true" /><span className="max-sm:sr-only">{t.quoteThis}</span>
          </Link>
        )}
        <div ref={menuRef} className="relative max-sm:shrink-0">
          <button ref={menuButtonRef} type="button" onClick={() => setMenuOpen(open => !open)} aria-expanded={menuOpen} aria-haspopup="menu" aria-label={ui('More actions')} title={ui('More actions')}
            className={`${button.ghost} max-sm:size-11 max-sm:border max-sm:border-slate-200 max-sm:bg-white max-sm:px-0 max-sm:dark:border-slate-700 max-sm:dark:bg-slate-800 sm:h-full`}>
            <MoreHorizontal size={18} aria-hidden="true" />
          </button>
          {menuOpen && (
            <div role="menu" className="absolute right-0 top-full z-30 mt-2 w-56 rounded-2xl border border-slate-100 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-800">
              {article.videoUrl && (
                <a role="menuitem" href={article.videoUrl} target="_blank" rel="noopener noreferrer" onClick={() => setMenuOpen(false)} className={menuItem}>
                  <PlayCircle size={16} aria-hidden="true" />{ui('Watch video')}
                </a>
              )}
              <button role="menuitem" type="button" onClick={startReport} className={menuItem}>
                <Flag size={16} aria-hidden="true" />{t.reportIssue}
              </button>
            </div>
          )}
        </div>
      </div>
      {reporting && <div className="mt-3"><ReportIssue articleId={articleId} isDark={isDark} opened onClose={() => setReporting(false)} /></div>}
    </div>
  );
}
