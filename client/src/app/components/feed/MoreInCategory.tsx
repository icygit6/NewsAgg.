import { useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { useUiText } from '../../i18n/uiText';
import { CATEGORY_ACCENT, CATEGORY_GROUP_HOVER_TEXT, CATEGORY_LABELS, CATEGORY_TEXT, TOPIC_TO_CATEGORY, categoryVars } from '../../constants';
import { getArticleId } from '../../services/newsAPI';
import { formatNewsDate } from '../../lib/formatDate';
import type { NewsArticle } from '../../types/article';

/** Preview (A4): a text-only run of headlines from one category, dropped into the grid to break
 * the rhythm of image cards. Filled, not outlined; the category colour carries it. */
export function MoreInCategory({ articles }: { articles: NewsArticle[] }) {
  const ui = useUiText();
  const listRef = useRef<HTMLOListElement>(null);
  const [visibleCount, setVisibleCount] = useState(2);
  const { language, selectedCategory, setSelectedCategory } = useApp();
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const fit = () => {
      if (!list.clientHeight) return;
      const gap = parseFloat(getComputedStyle(list).rowGap) || 0;
      let used = 0;
      let count = 0;
      for (const row of Array.from(list.children) as HTMLElement[]) {
        const next = row.getBoundingClientRect().height + (count ? gap : 0);
        if (used + next > list.clientHeight + 1) break;
        used += next;
        count++;
      }
      setVisibleCount(count);
    };
    const observer = new ResizeObserver(fit);
    observer.observe(list);
    Array.from(list.children).forEach(row => observer.observe(row));
    fit();
    return () => observer.disconnect();
  }, [articles, language]);
  const category = TOPIC_TO_CATEGORY[articles[0].topic];
  const accent = CATEGORY_ACCENT[category];

  return (
    <section
      data-testid="more-in-category"
      aria-label={`${ui('More in')} ${ui(CATEGORY_LABELS[category])}`}
      style={categoryVars(category)}
      className={`flex min-w-0 flex-col rounded-2xl p-3 [contain:size] @min-[64rem]:p-5 bg-slate-100 dark:bg-slate-900`}
    >
      <h2 className="flex items-center gap-2 text-sm font-bold sm:text-lg">
        <span aria-hidden className="h-3 w-3 shrink-0 rounded-full" style={{ background: accent }} />
        {ui('More in')} {ui(CATEGORY_LABELS[category])}
      </h2>
      <ol ref={listRef} className="relative mt-2 flex min-h-0 flex-1 flex-col gap-1 overflow-hidden">
        {articles.map((article, index) => (
          <li key={article.id} aria-hidden={index >= visibleCount || undefined} className={index >= visibleCount ? 'invisible absolute top-0 left-0 w-full pointer-events-none' : 'shrink-0'}>
            <Link tabIndex={index >= visibleCount ? -1 : undefined} to={`/article/${getArticleId(article)}`} className={`group block rounded-xl px-1 py-1 text-xs transition-colors sm:px-1 sm:py-1 sm:text-sm @min-[64rem]:text-base hover:bg-white dark:hover:bg-slate-800`}>
              <span className={`news-headline line-clamp-2 font-semibold leading-snug transition-colors ${CATEGORY_GROUP_HOVER_TEXT} text-[#0b1f33] dark:text-slate-100`}>{article.title}</span>
              <span className={`mt-1 block text-xs text-slate-500 dark:text-slate-400`}>{article.source.name} · {formatNewsDate(article.publishedAt, language)}</span>
            </Link>
          </li>
        ))}
      </ol>
      {selectedCategory !== category && <button type="button" onClick={() => setSelectedCategory(category)} className={`mt-3 inline-flex shrink-0 min-h-11 items-center gap-1.5 self-start rounded-lg text-sm font-semibold hover:underline ${CATEGORY_TEXT}`}>
        {ui('See all')} <ArrowRight size={16} />
      </button>}
    </section>
  );
}
