import { useUiText } from '../../i18n/uiText';
import { Link } from 'react-router';
import { Sun, Moon } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { BrandLogo } from '../ui/BrandLogo';
import { SearchBox } from './SearchBox';

/** Mobile/tablet top bar (hidden ≥lg): brand, search and theme toggle. Filters live
 * in the FeedHeader; navigation lives in the BottomTabBar. */
export function TopBar() {
  const ui = useUiText();
  const { isDark, toggleTheme } = useApp();

  return (
    <div
      className={`sticky top-0 z-40 flex items-center gap-3 border-b bg-[var(--page-bg)] px-4 py-2.5 lg:hidden
        ${isDark ? 'border-slate-800' : 'border-slate-200'}`}
    >
      <Link to="/" className="shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" aria-label={ui("NewsAgg home")}>
        <BrandLogo showWordmark={false} markClassName="w-9 h-9" />
      </Link>
      <div className="flex-1 min-w-0">
        <SearchBox />
      </div>
      <button
        onClick={toggleTheme}
        className={`shrink-0 rounded-full p-2 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'}`}
        aria-label={ui("Toggle theme")}
      >
        {isDark ? <Sun size={18} /> : <Moon size={18} />}
      </button>
    </div>
  );
}
