import { useUiPunctuation, useUiText } from '../../i18n/uiText';
import { Link } from 'react-router';
import { Sun, Moon } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { BrandLogo } from '../ui/BrandLogo';
import { SearchBox } from './SearchBox';

/** Mobile/tablet top bar (hidden ≥lg): brand, search and theme toggle. Filters live
 * in the FeedHeader; navigation lives in the BottomTabBar. */
export function TopBar() {
  const ui = useUiText();
  const p = useUiPunctuation();
  const { isDark, toggleTheme } = useApp();
  // Names the theme in use, e.g. "Toggle theme (Dark)", to match the icon.
  const themeLabel = `${ui('Toggle theme')}${p.open}${ui(isDark ? 'Dark' : 'Light')}${p.close}`;

  return (
    <div
      className={`sticky top-0 z-40 flex items-center gap-3 border-b bg-[var(--page-bg)] px-4 py-2.5 lg:hidden
        border-slate-200 dark:border-slate-800`}
    >
      {/* flex, not inline: an inline link leaves a descender gap under the mark, which sits it above the search and theme button's centre line. */}
      <Link to="/" className="flex shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" aria-label={ui("NewsAgg home")}>
        <BrandLogo showWordmark={false} markClassName="w-9 h-9" />
      </Link>
      <div className="flex-1 min-w-0">
        <SearchBox />
      </div>
      <button
        onClick={toggleTheme}
        className={`shrink-0 rounded-full p-2 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800`}
        aria-label={themeLabel} title={themeLabel}
      >
        {/* The icon shows the theme in use, not the one a press switches to. */}
        {isDark ? <Moon size={20} /> : <Sun size={20} />}
      </button>
    </div>
  );
}
