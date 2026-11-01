import { Quote as QuoteIcon } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import type { DailyQuote } from '../../types/api';

interface QuoteCardProps {
  quote: DailyQuote;
  pinned?: boolean;
}

/** One FavQs quote rendered as a feed card. `pinned` marks the quote of the
 * day at the top of the Pulse rail. */
export function QuoteCard({ quote, pinned = false }: QuoteCardProps) {
  const { t } = useApp();

  return (
    <div
      className={`rounded-2xl border p-4 bg-white border-slate-200 dark:bg-slate-900/70 dark:border-slate-800 ${pinned ? 'border-l-4 border-l-[var(--brand,#2563eb)]' : ''}`}
    >
      <div className="flex items-center gap-1.5 mb-2">
        <QuoteIcon size={14} className="text-[var(--brand,#2563eb)]" />
        <span
          className={`text-xs text-slate-400 dark:text-slate-500`}
        >
          {pinned ? t.quoteOfDay : 'FavQs'}
        </span>
      </div>
      <p
        className={`text-sm italic leading-relaxed text-slate-700 dark:text-slate-200`}
      >
        “{quote.quote}”
      </p>
      <p
        className={`mt-2 text-xs font-semibold text-right text-slate-500 dark:text-slate-500`}
      >
        — {quote.author}
      </p>
    </div>
  );
}
