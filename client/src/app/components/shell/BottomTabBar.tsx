import { NavLink } from 'react-router';
import { Home, MessageSquareQuote, Bookmark, BarChart2 } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { POSTS_ENABLED } from '../../constants';

/** Small/medium-screen bottom navigation (hidden ≥lg, where NavRail takes over). */
export function BottomTabBar() {
  const { t, isDark, avatarSrc, user, authInitialized, setSidebarOpen } = useApp();
  const scrollTop = () => {
    document.getElementById('main-scroll')?.scrollTo({ top: 0, behavior: 'instant' });
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const items = [
    { to: '/', icon: Home, label: t.home },
    ...(POSTS_ENABLED ? [{ to: '/posts', icon: MessageSquareQuote, label: t.posts }] : []),
    { to: '/insights', icon: BarChart2, label: t.insights },
    { to: '/bookmarks', icon: Bookmark, label: t.bookmarks },
  ];
  const tabClass = (isActive: boolean) =>
    `group flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-[11px] font-medium leading-none transition-[color,background-color,transform] duration-200 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 motion-reduce:transition-none ${
      isActive
        ? 'text-[var(--brand,#2563eb)]'
        : isDark
          ? 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
    }`;
  const iconClass = (isActive: boolean) =>
    `flex h-8 w-12 items-center justify-center rounded-xl transition-colors duration-200 motion-reduce:transition-none ${
      isActive ? (isDark ? 'bg-blue-400/15' : 'bg-blue-500/10') : ''
    }`;
  const profileContent = (isActive: boolean) => (
    <>
      <span className={iconClass(isActive)}>
        <img
          src={avatarSrc}
          alt=""
          className={`h-[22px] w-[22px] rounded-full object-cover bg-slate-300 ${
            isActive ? 'ring-2 ring-[var(--brand,#2563eb)] ring-offset-1 ring-offset-transparent' : ''
          }`}
        />
      </span>
      <span className="block max-w-full truncate">{t.profile}</span>
    </>
  );

  return (
    <nav
      className={`fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur-xl lg:hidden
        ${isDark
          ? 'border-slate-700/70 bg-slate-950/95 shadow-[0_-8px_28px_rgba(0,0,0,0.24)]'
          : 'border-slate-200/90 bg-white/95 shadow-[0_-8px_28px_rgba(15,23,42,0.08)]'}`}
      aria-label={t.menu}
    >
      <div
        className="mx-auto flex w-full max-w-[640px] items-stretch gap-1 px-2 pt-2"
        style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
      >
        {items.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={scrollTop}
            title={label}
            aria-label={label}
            className={({ isActive }) => tabClass(isActive)}
          >
            {({ isActive }) => (
              <>
                <span className={iconClass(isActive)}>
                  <Icon size={21} strokeWidth={isActive ? 2.4 : 1.9} aria-hidden="true" />
                </span>
                <span className="block max-w-full truncate">{label}</span>
              </>
            )}
          </NavLink>
        ))}
        {user || !authInitialized ? (
          <NavLink
            to="/profile"
            onClick={scrollTop}
            title={t.profile}
            aria-label={t.profile}
            className={({ isActive }) => tabClass(isActive)}
          >
            {({ isActive }) => profileContent(isActive)}
          </NavLink>
        ) : (
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            title={t.profile}
            aria-label={t.profile}
            className={tabClass(false)}
          >
            {profileContent(false)}
          </button>
        )}
      </div>
    </nav>
  );
}
