import { Link } from 'react-router';

import { useApp } from '../../contexts/AppContext';
import { ImageWithFallback } from '../utils/ImageWithFallback';

interface EmbeddedArticleCardProps {
  articleId: string | null;
  title: string | null;
  image: string | null;
  topic: string | null;
  sourceName: string | null;
}

/** Compact X-style attached-article card inside a post. The article FK is
 * SET NULL on cleanup, so a missing article renders a tombstone instead. */
export function EmbeddedArticleCard({ articleId, title, image, topic, sourceName }: EmbeddedArticleCardProps) {
  const { t } = useApp();

  if (!articleId || !title) {
    return (
      <div className={`mt-2 rounded-xl border px-3 py-2.5 text-xs border-slate-200 text-slate-400 dark:border-slate-700 dark:text-slate-500`}>
        {t.articleUnavailable}
      </div>
    );
  }

  return (
    <Link
      to={`/article/${articleId}`}
      className={`mt-2 flex gap-3 rounded-xl border overflow-hidden transition-colors border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/60`}
    >
      <ImageWithFallback src={image ?? undefined} alt="" className="w-24 h-20 object-cover shrink-0" loading="lazy" />
      <div className="py-2 pr-3 min-w-0 flex flex-col justify-center">
        <p className={`text-xs truncate text-slate-400 dark:text-slate-500`}>
          {[sourceName, topic].filter(Boolean).join(' · ')}
        </p>
        <p className={`text-sm font-medium leading-snug line-clamp-2 text-slate-900 dark:text-slate-100`}>
          {title}
        </p>
      </div>
    </Link>
  );
}
