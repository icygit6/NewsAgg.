import { NavLink } from 'react-router';
import { Home, MessageSquareQuote, Bookmark, BarChart2, ShieldCheck } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { useAdminOverview, useIsAdmin } from '../../hooks/useAdmin';
import { useUiText } from '../../i18n/uiText';
import { POSTS_ENABLED } from '../../constants';

interface TabItem {
  to: string;
  icon: typeof Home;
  label: string;
  badge?: number;
}

/** Small/medium-screen bottom navigation (hidden ≥lg, where NavRail takes over). */
export function BottomTabBar() {
  const ui = useUiText();
  const { t, isDark, avatarSrc, user, authInitialized, setSidebarOpen } = useApp();
  // Admins get the same entry point the desktop rail gives them.
  const admin = useIsAdmin();
  const adminOverview = useAdminOverview();
  const openReports = (adminOverview.data?.open_article_reports ?? 0) + (adminOverview.data?.open_post_reports ?? 0);
  const scrollTop = () => {
    document.getElementById('main-scroll')?.scrollTo({ top: 0, behavior: 'instant' });
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const items: TabItem[] = [
    { to: '/', icon: Home, label: t.home },
    ...(POSTS_ENABLED ? [{ to: '/posts', icon: MessageSquareQuote, label: t.posts }] : []),
    { to: '/insights', icon: BarChart2, label: t.insights },
    { to: '/bookmarks', icon: Bookmark, label: t.bookmarks },
    ...(admin ? [{ to: '/admin', icon: ShieldCheck, label: ui('Admin'), badge: openReports }] : []),
  ];
  // The admin tab makes six; tighten the labels so none of them truncates.
  const dense = items.length > 4;
  const tabClass = (isActive: boolean) =>
    `group flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl py-1.5 font-medium leading-none transition-[color,background-color,transform] duration-200 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 motion-reduce:transition-none ${
      dense ? 'px-0 text-[10px]' : 'px-1 text-[11px]'
    } ${
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
        className={`mx-auto flex w-full max-w-[640px] items-stretch pt-2 ${dense ? 'gap-0 px-1' : 'gap-1 px-2'}`}
        style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
      >
        {items.map(({ to, icon: Icon, label, badge }) => (
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
                <span className={`relative ${iconClass(isActive)}`}>
                  <Icon size={21} strokeWidth={isActive ? 2.4 : 1.9} aria-hidden="true" />
                  {badge ? (
                    <span
                      className="absolute right-1 top-0 min-w-4 rounded-full bg-rose-500 px-1 text-center text-[10px] font-bold leading-4 text-white"
                      aria-label={`${badge} ${ui('open reports')}`}
                    >
                      {badge}
                    </span>
                  ) : null}
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
