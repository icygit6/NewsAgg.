import { NavLink } from 'react-router';
import { Home, MessageSquareQuote, Bookmark, BarChart2, ShieldCheck } from 'lucide-react';
import { useApp, useSidebarOpen } from '../../contexts/AppContext';
import { adminAttentionCount, useAdminAttention, useIsAdmin } from '../../hooks/useAdmin';
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
  const { t, avatarSrc, setSidebarOpen } = useApp();
  const sidebarOpen = useSidebarOpen();
  // Admins get the same entry point the desktop rail gives them.
  const admin = useIsAdmin();
  const adminAttention = useAdminAttention();
  const openReports = adminAttentionCount(adminAttention.data);
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
      dense ? 'px-0 text-[11px]' : 'px-1 text-xs'
    } ${
      isActive
        ? 'text-[var(--brand,#2563eb)]'
        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-100'
    }`;
  const iconClass = (isActive: boolean) =>
    `flex h-8 w-12 items-center justify-center rounded-xl transition-colors duration-200 motion-reduce:transition-none ${
      isActive ? ('bg-blue-500/10 dark:bg-blue-400/15') : ''
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
      className={`fixed inset-x-0 bottom-0 z-40 border-t bg-[var(--page-bg)] before:pointer-events-none before:absolute before:inset-x-0 before:bottom-full before:h-2 before:bg-gradient-to-t before:from-[var(--page-bg)] before:to-transparent lg:hidden
        border-slate-200 dark:border-slate-800`}
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
                  <Icon size={22} strokeWidth={isActive ? 2.4 : 1.9} aria-hidden="true" />
                  {badge ? (
                    <span
                      className="absolute right-1 top-0 min-w-4 rounded-full bg-red-500 px-1 text-center text-[11px] font-bold leading-4 text-white"
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
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            title={t.profile}
            aria-label={t.profile}
            aria-haspopup="dialog"
            aria-expanded={sidebarOpen}
            className={tabClass(sidebarOpen)}
          >
            {profileContent(sidebarOpen)}
          </button>
      </div>
    </nav>
  );
}
