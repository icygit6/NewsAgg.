import { useUiText } from '../../i18n/uiText';
import { Search, X } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useApp } from '../../contexts/AppContext';

/** Global search input (moved from the old Header into the right rail / top
 * bar). Typing filters the feed server-side via the debounced `q` param. */
export function SearchBox({ autoFocus = false }: { autoFocus?: boolean }) {
  const ui = useUiText();
  const { t, searchQuery, setSearchQuery } = useApp();
  const navigate = useNavigate();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchQuery.trim()) navigate('/');
    if (e.key === 'Escape') setSearchQuery('');
  };

  return (
    <div
      className={`flex items-center gap-2 rounded-full px-4 py-2.5 border transition-all
        focus-within:ring-2 focus-within:ring-[var(--brand-ring,rgba(6,182,212,0.5))]
        bg-white border-slate-200 text-slate-900 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100`}
    >
      <Search size={16} className="text-slate-400 dark:text-slate-500" />
      <input
        type="search"
        name="search"
        autoComplete="off"
        // Only the desktop pop-over asks for this: it opens because the reader
        // clicked Search, so typing should go straight in. The always-visible
        // mobile and top-bar boxes must not grab focus (or the phone keyboard).
        autoFocus={autoFocus}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t.searchPlaceholder}
        aria-label={t.search}
        // type="search" keeps the mobile search keyboard, but Chromium also
        // draws its own clear (×) control next to ours; hide the native one.
        className="flex-1 min-w-0 bg-transparent outline-none text-sm placeholder:text-slate-400 font-sans [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none"
      />
      {searchQuery && (
        <button
          type="button"
          onClick={() => setSearchQuery('')}
          className={`-my-1 -mr-2 grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300`}
          aria-label={ui("Clear search")}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
