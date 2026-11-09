import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { useUiText } from '../../i18n/uiText';
import { CATEGORY_BADGE_CLASS, CATEGORY_GROUP_HOVER_TEXT, CATEGORY_LABELS, CATEGORY_TEXT, TOPIC_TO_CATEGORY, categoryVars } from '../../constants';
import { getArticleId } from '../../services/newsAPI';
import { formatNewsDate } from '../../lib/formatDate';
import { useLatestArticles } from '../../hooks/useArticles';
import { useTitleTranslations } from '../../hooks/useTitleTranslations';
import type { NewsArticle } from '../../types/article';

/** Preview (A4): a text-only run of headlines from one category, dropped into the grid to break
 * the rhythm of image cards. Filled, not outlined; the category colour carries it. */
const MAX_HEADLINES = 10;

export function MoreInCategory({ articles, exclude }: { articles: NewsArticle[]; exclude?: ReadonlySet<string> }) {
  const ui = useUiText();
  const listRef = useRef<HTMLOListElement>(null);
  const [visibleCount, setVisibleCount] = useState(2);
  const { language, selectedCategory, setSelectedCategory } = useApp();
  const category = TOPIC_TO_CATEGORY[articles[0].topic];
  // A feed batch rarely holds more than three or four stories from one category, which left
  // tall boxes half empty. Top up with the category's newest other stories (the feed's
  // filters still apply), skipping any the feed has already loaded; the box shows what fits.
  const { data: latest } = useLatestArticles({ limit: 12, category });
  const extra = useTitleTranslations(useMemo(() => {
    const taken = new Set(articles.map(article => article.id));
    return (latest?.articles ?? []).filter(article =>
      TOPIC_TO_CATEGORY[article.topic] === category && !taken.has(article.id) && !exclude?.has(article.id));
  }, [latest, articles, category, exclude]));
  const headlines = useMemo(() => [...articles, ...extra].slice(0, MAX_HEADLINES), [articles, extra]);
  const headlineKey = headlines.map(article => article.id).join();
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
  }, [headlineKey, language]);

  return (
    <section
      data-testid="more-in-category"
      aria-label={`${ui('More in')} ${ui(CATEGORY_LABELS[category])}`}
      style={categoryVars(category)}
      className={`flex min-w-0 flex-col rounded-2xl p-3 [contain:size] @min-[64rem]:p-5 bg-slate-100 dark:bg-slate-900`}
    >
      <h2 className="flex items-center gap-2 text-sm font-bold sm:text-lg">
        {ui('More in')}
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold sm:text-sm ${CATEGORY_BADGE_CLASS[category]}`}>{ui(CATEGORY_LABELS[category])}</span>
      </h2>
      <ol ref={listRef} className="relative mt-2 flex min-h-0 flex-1 flex-col gap-1 overflow-hidden">
        {headlines.map((article, index) => (
          <li key={article.id} aria-hidden={index >= visibleCount || undefined} className={index >= visibleCount ? 'invisible absolute top-0 left-0 w-full pointer-events-none' : 'shrink-0'}>
            <Link tabIndex={index >= visibleCount ? -1 : undefined} to={`/article/${getArticleId(article)}`} className={`group block rounded-xl px-1 py-1 text-xs transition-colors sm:px-1 sm:py-1 sm:text-sm @min-[64rem]:text-base hover:bg-white dark:hover:bg-slate-800`}>
              <span className={`news-headline line-clamp-2 font-semibold leading-snug transition-colors ${CATEGORY_GROUP_HOVER_TEXT} text-[#0b1f33] dark:text-slate-100`}>{article.title}</span>
              <span className={`mt-1 block text-xs text-slate-500 dark:text-slate-400`}>{article.source.name} · {formatNewsDate(article.publishedAt, language)}</span>
            </Link>
          </li>
        ))}
      </ol>
      {selectedCategory !== category && <button type="button" onClick={() => setSelectedCategory(category)} className={`mt-3 inline-flex shrink-0 min-h-11 items-center gap-1.5 self-start rounded-lg text-sm font-semibold hover:opacity-80 ${CATEGORY_TEXT}`}>
        {ui('See all')} <ArrowRight size={16} />
      </button>}
    </section>
  );
}
