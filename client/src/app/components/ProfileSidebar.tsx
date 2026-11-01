import { useUiText } from '../i18n/uiText';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { X, LogOut, Bookmark, ChevronRight, Settings, ShieldCheck, MessageSquarePlus } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useApp } from '../contexts/AppContext';
import { useBookmarks } from '../hooks/useBookmarks';
import { adminAttentionCount, useAdminOverview, useIsAdmin } from '../hooks/useAdmin';
import { openFeedback } from '../hooks/useFeedback';
import { useProfilePrivacy } from '../hooks/useProfilePrivacy';
import { authService } from '../services/authService';
import { AuthPanel } from './profile/AuthPanel';
import { maskEmail } from '../lib/maskEmail';
import { FooterCompact } from './shell/Footer';
import { useIsMobile } from './ui/use-mobile';
import { BrandLogo } from './ui/BrandLogo';
import { useInterfaceLanguage } from './ui/LanguageSwitcher';
import { TranslateNewsToggle } from './ui/TranslateNewsToggle';
import { ThemePicker } from './ui/ThemePicker';
import { SegmentedControl } from './ui/SegmentedControl';
import { useEffect, useRef } from 'react';

/** Slim account drawer: identity card linking to /profile plus quick
 * settings rows. All account editing lives on the /settings page. */
export function ProfileSidebar() {
  const ui = useUiText();
  const {
    sidebarOpen, setSidebarOpen, isDark, t, user, setUser,
    avatarSrc,
  } = useApp();
  const { bookmarks } = useBookmarks();
  const admin = useIsAdmin();
  const adminOverview = useAdminOverview();
  const openReports = adminAttentionCount(adminOverview.data);
  const [hideEmail] = useProfilePrivacy('hideEmail');
  const navigate = useNavigate();
  // Match NavRail/BottomTabBar: no left navigation below lg (1024px).
  const isMobile = useIsMobile(1024);
  const reducedMotion = useReducedMotion();
  const drawerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!sidebarOpen) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const drawer = drawerRef.current;
    drawer?.querySelector<HTMLElement>('button, a, input, [tabindex]:not([tabindex="-1"])')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || (event.target instanceof Element && event.target.closest('[role="listbox"]'))) return;
      if (event.key === 'Escape') {
        setSidebarOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !drawer) return;
      const focusable = Array.from(drawer.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = priorOverflow;
      previousFocusRef.current?.focus();
    };
  }, [sidebarOpen, setSidebarOpen]);

  const goTo = (path: string) => {
    navigate(path);
    setSidebarOpen(false);
  };

  const handleLogout = async () => {
    const result = await authService.logout();
    if (result.success) setUser(null);
  };

  const reading = useInterfaceLanguage();

  const rowClass = `w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${
    isDark ? 'text-slate-200 hover:bg-slate-800' : 'text-gray-700 hover:bg-gray-50'
  }`;
  // Settings groups: a hairline above each, labelled like the profile page's Preferences card.
  const groupClass = `mt-5 pt-5 border-t ${isDark ? 'border-slate-800' : 'border-gray-100'}`;
  const groupLabel = `mb-3 text-xs font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`;
  const iconBox =`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-slate-700' : 'bg-gray-100'}`;

  return (
    <AnimatePresence>
      {sidebarOpen && (
        <>
          <motion.div
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.2, ease: 'easeOut' }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-[60] bg-black/30 backdrop-blur-[2px]"
          />

          <motion.div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label={user ? t.account : t.signIn}
            initial={{ transform: `translateX(${isMobile ? '100%' : '-100%'})`, opacity: 0 }}
            animate={{ transform: 'translateX(0%)', opacity: 1 }}
            exit={{ transform: `translateX(${isMobile ? '100%' : '-100%'})`, opacity: 0, transition: { duration: reducedMotion ? 0 : 0.2 } }}
            transition={{ duration: reducedMotion ? 0 : 0.3, ease: [0.32, 0.72, 0, 1] }}
            className={`account-drawer fixed inset-y-0 z-[70] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] w-[400px] max-w-[95vw] flex flex-col overflow-hidden shadow-2xl ${
              isMobile ? 'right-0 rounded-l-[28px]' : 'left-0 rounded-r-[28px]'
            } ${
              isDark
                ? 'bg-slate-900'
                : 'bg-white'
            }`}
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between px-6 py-5">
              <div className="flex items-center gap-2">
                <BrandLogo
                  markClassName="w-8 h-8"
                  wordmarkClassName="text-lg"
                />
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                aria-label={ui("Close account panel")}
                className={`p-2 rounded-xl transition-colors ${isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-gray-400 hover:bg-gray-100'}`}
              >
                <X size={18} />
              </button>
            </div>

            <div className="min-h-0 flex-1 px-6 pb-6 overflow-y-auto no-scrollbar">
              {user ? (
                <>
                  {/* Identity card → /profile */}
                  <button
                    onClick={() => goTo('/profile')}
                    className={`w-full flex items-center gap-3 p-3 mb-4 rounded-2xl text-left transition-colors ${
                      isDark ? 'bg-slate-800/70 hover:bg-slate-800' : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <img src={avatarSrc} alt={user.username} className="w-12 h-12 rounded-full object-cover bg-slate-300" />
                    <div className="flex-1 min-w-0">
                      <p className={`font-poppins font-bold leading-tight truncate ${isDark ? 'text-slate-100' : 'text-gray-900'}`}>
                        {user.username}
                      </p>
                      <p className={`text-xs truncate ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>{hideEmail ? maskEmail(user.email) : user.email}</p>
                      <span className="text-xs font-medium text-blue-600 dark:text-blue-400">{t.viewProfile}</span>
                    </div>
                    <ChevronRight size={16} className={isDark ? 'text-slate-500' : 'text-gray-400'} />
                  </button>

                  {/* Quick rows */}
                  <nav className="space-y-1">
                    <button onClick={() => goTo('/bookmarks')} className={rowClass}>
                      <div className={iconBox}><Bookmark size={16} className={isDark ? 'text-blue-400' : 'text-blue-600'} /></div>
                      <span className="font-medium flex-1">{t.bookmarks}</span>
                      <span className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>{bookmarks.length}</span>
                    </button>
                    <button onClick={() => goTo('/settings')} className={rowClass}>
                      <div className={iconBox}><Settings size={16} className={isDark ? 'text-blue-400' : 'text-blue-600'} /></div>
                      <span className="font-medium flex-1">{t.settings}</span>
                    </button>
                    {admin && (
                      <button onClick={() => goTo('/admin')} className={rowClass}>
                        <div className={iconBox}><ShieldCheck size={16} className={isDark ? 'text-blue-400' : 'text-blue-600'} /></div>
                        <span className="font-medium flex-1">{ui('Admin')}</span>
                        {openReports > 0 && <span className="rounded-full bg-rose-500 px-1.5 text-[11px] font-bold leading-5 text-white">{openReports}</span>}
                      </button>
                    )}
                  </nav>
                </>
              ) : (
                <AuthPanel isDark={isDark} onAuthenticated={() => setSidebarOpen(false)} />
              )}

              <section aria-labelledby="drawer-appearance" className={groupClass}>
                <h3 id="drawer-appearance" className={groupLabel}>{ui('Appearance')}</h3>
                <ThemePicker collapsible />
              </section>

              <section aria-labelledby="drawer-reading" className={groupClass}>
                <h3 id="drawer-reading" className={groupLabel}>{ui('Reading')}</h3>
                <SegmentedControl
                  label={t.language}
                  value={reading.choice}
                  onChange={reading.choose}
                  options={reading.options.map((opt) => ({ value: opt.code, title: opt.label, label: <span className="truncate">{opt.label}</span> }))}
                />
                <div className="mt-3">
                  <TranslateNewsToggle isDark={isDark} tray />
                </div>
              </section>

              {/* Feedback, for guests and signed-in readers alike */}
              <button
                onClick={() => { setSidebarOpen(false); openFeedback(); }}
                className={`mt-6 flex w-full min-h-11 items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm transition-colors ${
                  isDark ? 'bg-slate-800 text-slate-200 hover:bg-slate-700' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <MessageSquarePlus size={16} className="shrink-0 text-slate-500 dark:text-slate-400" />
                <span className="font-medium flex-1">{ui('Send feedback')}</span>
                <ChevronRight size={16} className={isDark ? 'text-slate-500' : 'text-gray-400'} />
              </button>

              <div className={`mt-6 pt-4 border-t ${isDark ? 'border-slate-700' : 'border-gray-100'}`}>
                <FooterCompact brief />
              </div>
            </div>

            {/* Sign out */}
            {user && (
              <div className={`p-4 border-t ${isDark ? 'border-slate-700' : 'border-gray-100'}`}>
                <button
                  onClick={() => void handleLogout()}
                  className={`w-full flex items-center gap-3 px-5 py-3.5 rounded-2xl font-semibold transition-all ${
                    isDark
                      ? 'bg-red-900/30 text-red-300 border border-red-700/50 hover:bg-red-900/40'
                      : 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
                  }`}
                >
                  <LogOut size={18} />
                  {t.signOut}
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
