import { useUiText } from '../i18n/uiText';
import { Link } from 'react-router';
import { Bookmark } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { useBookmarks } from '../hooks/useBookmarks';
import type { NewsArticle } from '../types/article';
import { getArticleId } from '../services/newsAPI';
import { CATEGORY_LABELS, type Category } from '../constants';
import { ImageWithFallback } from './utils/ImageWithFallback';
import { useTitleTranslations } from '../hooks/useTitleTranslations';

/** Reading-first category layout: one lead photograph, then quiet text rows. */
export function CategoryFeed({ articles, category, total }: { articles: NewsArticle[]; category: Category; total: number }) {
  const ui = useUiText();
  const { t, isDark, isAuthenticated, setSidebarOpen } = useApp();
  const { isBookmarked, bookmarkIdFor, add, remove } = useBookmarks();
  const translatedArticles = useTitleTranslations(articles);
  return (
    <section className="py-5">
      <header className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">{ui("NewsAgg / Latest news")}</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight">{ui(CATEGORY_LABELS[category])}</h1>
        </div>
        <p className="pb-1 text-sm text-slate-500 dark:text-slate-400">{total.toLocaleString()} {ui("articles")}</p>
      </header>
      <div className={`overflow-hidden rounded-2xl border ${isDark ? 'bg-slate-900 border-slate-800 divide-slate-800' : 'bg-white border-slate-200 divide-slate-200'} divide-y`}>
        {translatedArticles.map((article, index) => {
          const id = getArticleId(article);
          const saved = isBookmarked(id);
          const date = new Date(article.publishedAt);
          return (
            <article key={id} className={`p-5 sm:p-6 ${index === 0 ? 'pb-6' : ''}`}>
              {index === 0 && (article.urlToImage || article.images.length > 0) && (
                <Link to={`/article/${id}`} className="mb-5 block overflow-hidden rounded-xl">
                  <ImageWithFallback src={article.urlToImage || undefined} fallbackSources={article.images.map((image) => image.url)} alt={article.title} className="aspect-[2/1] max-h-72 w-full object-cover" />
                </Link>
              )}
              <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-bold text-blue-600 dark:text-blue-400">{article.source.name}</span>
                {!Number.isNaN(date.getTime()) && <time dateTime={article.publishedAt}>{date.toLocaleDateString()}</time>}
                <span>{t[article.sentiment.type]}</span>
              </div>
              <Link to={`/article/${id}`} className="group">
                <h2 className={`${index === 0 ? 'text-2xl' : 'text-lg'} font-bold leading-snug group-hover:text-blue-600 dark:text-blue-400 transition-colors`}>{article.title}</h2>
                {article.description && article.description.trim() !== article.title.trim() && <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{article.description}</p>}
              </Link>
              <div className="mt-3 flex items-center justify-between gap-3">
                <button
                  type="button"
                  aria-label={saved ? t.bookmarked : t.bookmark}
                  aria-pressed={saved}
                  disabled={add.isPending || remove.isPending}
                  className="rounded-full p-2 text-slate-500 dark:text-slate-400 hover:bg-blue-50 hover:text-blue-600 dark:text-blue-400 disabled:opacity-50"
                  onClick={() => {
                    if (!isAuthenticated) { setSidebarOpen(true); return; }
                    if (saved) { const bookmarkId = bookmarkIdFor(id); if (bookmarkId) remove.mutate(bookmarkId); }
                    else add.mutate(article);
                  }}
                ><Bookmark size={17} fill={saved ? 'currentColor' : 'none'} /></button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
