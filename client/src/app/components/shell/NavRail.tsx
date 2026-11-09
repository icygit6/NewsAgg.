import { useUiText } from '../../i18n/uiText';
import { useEffect, useRef, useState } from 'react';
import { NavLink, Link } from 'react-router';
import { Home, MessageSquareQuote, Bookmark, Palette, Languages, BarChart2, ShieldCheck } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { POSTS_ENABLED } from '../../constants';
import { useInterfaceLanguage } from '../../hooks/useInterfaceLanguage';
import { TranslateNewsToggle } from '../ui/TranslateNewsToggle';
import { SegmentedControl } from '../ui/SegmentedControl';
import { BrandLogo } from '../ui/BrandLogo';
import { ThemePicker } from '../ui/ThemePicker';
import { adminAttentionCount, useAdminAttention, useIsAdmin } from '../../hooks/useAdmin';

interface NavItem {
  to: string;
  icon: typeof Home;
  label: string;
  badge?: number;
}

export function NavRail() {
  const ui = useUiText();
  const { t, isDark, setSidebarOpen, avatarSrc, user } = useApp();
  const reading = useInterfaceLanguage();
  // The rail scrolls (overflow-y-auto), which would clip an absolutely
  // positioned menu; anchor a fixed menu to the button instead.
  const [langMenu, setLangMenu] = useState<{ left: number; bottom: number } | null>(null);
  const langOpen = langMenu !== null;
  const langRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!langOpen) return;
    const onDown = (event: PointerEvent) => {
      if (!langRef.current?.contains(event.target as Node)) setLangMenu(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLangMenu(null);
        langRef.current?.querySelector('button')?.focus();
      }
    };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [langOpen]);
  const [themeMenu, setThemeMenu] = useState<{ left: number; bottom: number } | null>(null);
  const themeRef = useRef<HTMLDivElement>(null);
  // The theme panel closes on Escape or a click outside it.
  useEffect(() => {
    if (!themeMenu) return;
    const onDown = (event: MouseEvent) => { if (!themeRef.current?.contains(event.target as Node)) setThemeMenu(null); };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setThemeMenu(null); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [themeMenu]);
  const currentLang = reading.current.short;
  const admin = useIsAdmin();
  const adminAttention = useAdminAttention();
  const openReports = adminAttentionCount(adminAttention.data);

  const items: NavItem[] = [
    { to: '/', icon: Home, label: t.home },
    ...(POSTS_ENABLED ? [{ to: '/posts', icon: MessageSquareQuote, label: t.posts }] : []),
    { to: '/insights', icon: BarChart2, label: t.insights },
    { to: '/bookmarks', icon: Bookmark, label: t.bookmarks },
    ...(admin ? [{ to: '/admin', icon: ShieldCheck, label: ui('Admin'), badge: openReports }] : []),
  ];

  const baseItem = `flex items-center gap-4 rounded-full px-3 py-3 xl:px-4 transition-[background-color,color,transform,box-shadow] duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 motion-reduce:transition-none
    hover:bg-slate-200/70 dark:hover:bg-slate-800`;

  return (
    <nav
      className={`hidden lg:flex h-full w-[68px] xl:w-[240px] shrink-0 flex-col
        items-center xl:items-stretch gap-1 px-2 xl:px-4 py-4 border-r overflow-y-auto
        border-slate-200 dark:border-slate-800`}
      style={{ scrollbarWidth: 'none' }}
      aria-label={t.menu}
    >
      <Link to="/" className="mb-4 flex items-center gap-2 rounded-xl px-2 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" aria-label={ui("NewsAgg home")}>
        <BrandLogo
          size="md"
          wordmarkClassName="hidden xl:inline"
        />
      </Link>

      {items.map(({ to, icon: Icon, label, badge }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          title={label}
          aria-label={label}
          className={({ isActive }) =>
            `${baseItem} ${
              isActive ? 'font-semibold text-white shadow-sm shadow-blue-500/20' : 'text-slate-700 dark:text-slate-200'
            }`
          }
          style={({ isActive }) => (isActive ? { background: 'var(--brand, #2563eb)' } : undefined)}
        >
          <span className="relative shrink-0">
            <Icon size={22} />
            {badge ? <span className="absolute -top-1.5 -right-2 min-w-4 rounded-full bg-red-500 px-1 text-center text-[11px] font-bold leading-4 text-white" aria-label={`${badge} ${ui('open reports')}`}>{badge}</span> : null}
          </span>
          <span className="hidden xl:inline text-[15px]">{label}</span>
        </NavLink>
      ))}

      <div className="mt-auto flex flex-col items-center xl:items-stretch gap-1 w-full">
        <div ref={themeRef} className="relative w-full">
          <button
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setThemeMenu((open) => (open ? null : { left: r.left, bottom: window.innerHeight - r.top + 4 }));
            }}
            title={ui('Theme')}
            aria-expanded={themeMenu !== null}
            className={`${baseItem} w-full text-slate-700 dark:text-slate-200`}
          >
            <Palette size={22} className="shrink-0" />
            <span className="hidden xl:inline text-[15px]">{ui('Theme')}</span>
          </button>
          {themeMenu && (
            <div
              role="dialog"
              aria-label={ui('Theme')}
              className={`fixed z-50 w-80 rounded-2xl border p-3 shadow-lg bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-700`}
              style={{ left: themeMenu.left, bottom: themeMenu.bottom }}
            >
              <ThemePicker />
            </div>
          )}
        </div>

        <div ref={langRef} className="relative w-full">
          <button
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setLangMenu((open) => (open ? null : { left: r.left, bottom: window.innerHeight - r.top + 4 }));
            }}
            title={`${t.language}: ${reading.current.label}`}
            aria-expanded={langOpen}
            className={`${baseItem} w-full text-slate-700 dark:text-slate-200`}
          >
            <Languages size={22} className="shrink-0" />
            <span className="hidden xl:inline text-[15px]">{currentLang}</span>
          </button>
          {langOpen && (
            <div
              className={`fixed z-50 w-72 rounded-xl border p-1 shadow-lg bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-700`}
              style={{ left: langMenu.left, bottom: langMenu.bottom }}
            >
              {/* Side by side in one track, like the Insights / Pulse switch (and the drawer's language control). */}
              <div className="p-1">
                <SegmentedControl
                  label={t.language}
                  value={reading.choice}
                  onChange={(code) => { reading.choose(code); setLangMenu(null); }}
                  options={reading.options.map(({ code, label }) => ({ value: code, title: label, label: <span className="truncate">{label}</span> }))}
                />
              </div>
              <div className={`my-1 border-t border-slate-200 dark:border-slate-700`} />
              <TranslateNewsToggle isDark={isDark} compact />
            </div>
          )}
        </div>

        <button
          onClick={() => setSidebarOpen(true)}
          title={t.profile}
          className={`${baseItem} text-slate-700 dark:text-slate-200`}
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
