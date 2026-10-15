import { useUiText } from '../../i18n/uiText';
import { useState } from 'react';
import { NavLink, Link } from 'react-router';
import { Home, MessageSquareQuote, Bookmark, Sun, Moon, Languages, BarChart2 } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { POSTS_ENABLED } from '../../constants';
import { useReadingChoice } from '../ui/LanguageSwitcher';
import { BrandLogo } from '../ui/BrandLogo';

interface NavItem {
  to: string;
  icon: typeof Home;
  label: string;
}

export function NavRail() {
  const ui = useUiText();
  const { t, isDark, toggleTheme, setSidebarOpen, avatarSrc, user } = useApp();
  const reading = useReadingChoice();
  const [langOpen, setLangOpen] = useState(false);
  const currentLang = reading.current.short;

  const items: NavItem[] = [
    { to: '/', icon: Home, label: t.home },
    ...(POSTS_ENABLED ? [{ to: '/posts', icon: MessageSquareQuote, label: t.posts }] : []),
    { to: '/insights', icon: BarChart2, label: t.insights },
    { to: '/bookmarks', icon: Bookmark, label: t.bookmarks },
  ];

  const baseItem = `flex items-center gap-4 rounded-full px-3 py-3 xl:px-4 transition-[background-color,color,transform,box-shadow] duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 motion-reduce:transition-none
    ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-200/70'}`;

  return (
    <nav
      className={`hidden lg:flex h-full w-[68px] xl:w-[240px] shrink-0 flex-col
        items-center xl:items-stretch gap-1 px-2 xl:px-4 py-4 border-r overflow-y-auto
        ${isDark ? 'border-slate-800' : 'border-slate-200'}`}
      style={{ scrollbarWidth: 'none' }}
      aria-label={t.menu}
    >
      <Link to="/" className="mb-4 flex items-center gap-2 rounded-xl px-2 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" aria-label={ui("NewsAgg home")}>
        <BrandLogo
          markClassName="w-10 h-10"
          wordmarkClassName={`hidden xl:inline text-xl ${isDark ? 'text-slate-100' : 'text-slate-900'}`}
        />
      </Link>

      {items.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          title={label}
          aria-label={label}
          className={({ isActive }) =>
            `${baseItem} ${
              isActive ? 'font-semibold text-white shadow-sm shadow-blue-500/20' : isDark ? 'text-slate-200' : 'text-slate-700'
            }`
          }
          style={({ isActive }) => (isActive ? { background: 'var(--brand, #2563eb)' } : undefined)}
        >
          <Icon size={22} className="shrink-0" />
          <span className="hidden xl:inline text-[15px]">{label}</span>
        </NavLink>
      ))}

      <div className="mt-auto flex flex-col items-center xl:items-stretch gap-1 w-full">
        <button
          onClick={toggleTheme}
          title={isDark ? t.lightMode : t.darkMode}
          className={`${baseItem} ${isDark ? 'text-slate-200' : 'text-slate-700'}`}
        >
          {isDark ? (
            <Sun size={22} className="shrink-0" />
          ) : (
            <Moon size={22} className="shrink-0" />
          )}
          <span className="hidden xl:inline text-[15px]">{isDark ? t.lightMode : t.darkMode}</span>
        </button>

        <div className="relative w-full">
          <button
            onClick={() => setLangOpen((p) => !p)}
            title={`${t.newsLanguageTitle}: ${reading.current.label}`}
            aria-expanded={langOpen}
            className={`${baseItem} w-full ${isDark ? 'text-slate-200' : 'text-slate-700'}`}
          >
            <Languages size={22} className="shrink-0" />
            <span className="hidden xl:inline text-[15px]">{currentLang}</span>
          </button>
          {langOpen && (
            <div
              className={`absolute bottom-full mb-1 left-0 z-50 min-w-[112px] rounded-xl border p-1 shadow-lg ${
                isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
              }`}
            >
              {reading.options.map(({ code, short, label }) => (
                <button
                  key={code}
                  title={label}
                  onClick={() => {
                    reading.choose(code);
                    setLangOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    reading.choice === code
                      ? 'text-white'
                      : isDark
                        ? 'text-slate-200 hover:bg-slate-800'
                        : 'text-slate-700 hover:bg-slate-100'
                  }`}
                  style={
                    reading.choice === code ? { background: 'var(--brand-grad, #2563eb)' } : undefined
                  }
                >
                  {short}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => setSidebarOpen(true)}
          title={t.profile}
          className={`${baseItem} ${isDark ? 'text-slate-200' : 'text-slate-700'}`}
        >
          <img
            src={avatarSrc}
            alt={t.profile}
            className="w-7 h-7 rounded-full object-cover shrink-0 bg-slate-300"
          />
          <span className="hidden xl:inline text-[15px] truncate">
            {user?.username || t.signIn}
          </span>
        </button>
      </div>
    </nav>
  );
}
