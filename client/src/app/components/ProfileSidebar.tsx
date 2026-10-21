import { useUiText } from '../i18n/uiText';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { X, LogOut, Bookmark, Sun, Moon, Check, UserCircle, ChevronRight, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useApp } from '../contexts/AppContext';
import { useBookmarks } from '../hooks/useBookmarks';
import { useAdminOverview, useIsAdmin } from '../hooks/useAdmin';
import { useProfilePrivacy } from '../hooks/useProfilePrivacy';
import { authService } from '../services/authService';
import { AuthPanel } from './profile/AuthPanel';
import { maskEmail } from './profile/ProfileHeader';
import { FooterCompact } from './shell/Footer';
import { useIsMobile } from './ui/use-mobile';
import { BrandLogo } from './ui/BrandLogo';
import { useInterfaceLanguage } from './ui/LanguageSwitcher';
import { TranslateNewsToggle } from './ui/TranslateNewsToggle';
import { useEffect, useRef } from 'react';

/** Slim account drawer: identity card linking to /profile plus quick
 * settings rows. All account editing lives on the /profile page. */
export function ProfileSidebar() {
  const ui = useUiText();
  const {
    sidebarOpen, setSidebarOpen, isDark, toggleTheme, t, user, setUser,
    avatarSrc,
  } = useApp();
  const { bookmarks } = useBookmarks();
  const admin = useIsAdmin();
  const adminOverview = useAdminOverview();
  const openReports = (adminOverview.data?.open_article_reports ?? 0) + (adminOverview.data?.open_post_reports ?? 0);
  const [hideEmail] = useProfilePrivacy('hideEmail');
  const navigate = useNavigate();
  const isMobile = useIsMobile();
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
  const iconBox = `w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-slate-700' : 'bg-gray-100'}`;

  return (
    <AnimatePresence>
      {sidebarOpen && (
        <>
          <motion.div
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.2 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
          />

          <motion.div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label={user ? t.account : t.signIn}
            initial={{ x: isMobile ? '100%' : '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: isMobile ? '100%' : '-100%' }}
            transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 350, damping: 35 }}
            className={`fixed top-0 bottom-0 z-[70] ${user ? 'w-[344px]' : 'w-[400px]'} max-w-[95vw] flex flex-col shadow-2xl ${
              isMobile ? 'right-0' : 'left-0'
            } ${
              isDark
                ? isMobile ? 'bg-slate-900 border-l border-slate-700' : 'bg-slate-900 border-r border-slate-700'
                : isMobile ? 'bg-white border-l border-gray-100' : 'bg-white border-r border-gray-100'
            }`}
          >
            {/* Header */}
            <div className={`flex items-center justify-between p-5 border-b ${isDark ? 'border-slate-700' : 'border-gray-100'}`}>
              <div className="flex items-center gap-2">
                <BrandLogo
                  markClassName="w-8 h-8"
                  wordmarkClassName={`text-lg ${isDark ? 'text-slate-100' : 'text-slate-900'}`}
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

            <div className="flex-1 p-4 overflow-y-auto no-scrollbar">
              {user ? (
                <>
                  {/* Identity card → /profile */}
                  <button
                    onClick={() => goTo('/profile')}
                    className={`w-full flex items-center gap-3 p-3 mb-4 rounded-2xl text-left transition-colors ${
                      isDark ? 'bg-slate-800/70 hover:bg-slate-800' : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <img src={avatarSrc} alt={user.username} className="w-12 h-12 rounded-xl object-cover bg-slate-300" />
                    <div className="flex-1 min-w-0">
                      <p className={`font-poppins font-bold leading-tight truncate ${isDark ? 'text-slate-100' : 'text-gray-900'}`}>
                        {user.username}
                      </p>
                      <p className={`text-xs truncate ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>{hideEmail ? maskEmail(user.email) : user.email}</p>
                      <span className="text-xs font-medium text-cyan-500">{t.viewProfile}</span>
                    </div>
                    <ChevronRight size={16} className={isDark ? 'text-slate-500' : 'text-gray-400'} />
                  </button>

                  {/* Quick rows */}
                  <nav className="space-y-1">
                    <button onClick={() => goTo('/profile')} className={rowClass}>
                      <div className={iconBox}><UserCircle size={16} className={isDark ? 'text-cyan-400' : 'text-cyan-600'} /></div>
                      <span className="font-medium flex-1">{t.profile}</span>
                    </button>
                    <button onClick={() => goTo('/bookmarks')} className={rowClass}>
                      <div className={iconBox}><Bookmark size={16} className={isDark ? 'text-cyan-400' : 'text-cyan-600'} /></div>
                      <span className="font-medium flex-1">{t.bookmarks}</span>
                      <span className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>{bookmarks.length}</span>
                    </button>
                    {admin && (
                      <button onClick={() => goTo('/admin')} className={rowClass}>
                        <div className={iconBox}><ShieldCheck size={16} className={isDark ? 'text-cyan-400' : 'text-cyan-600'} /></div>
                        <span className="font-medium flex-1">{ui('Admin')}</span>
                        {openReports > 0 && <span className="rounded-full bg-rose-500 px-1.5 text-[11px] font-bold leading-5 text-white">{openReports}</span>}
                      </button>
                    )}
                  </nav>
                </>
              ) : (
                <AuthPanel isDark={isDark} onAuthenticated={() => setSidebarOpen(false)} />
              )}

              {/* Appearance */}
              <p className={`mt-5 mb-2 text-[11px] font-semibold uppercase tracking-wide ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                {t.appearance}
              </p>
              <button onClick={toggleTheme} role="switch" aria-checked={isDark} className={rowClass}>
                <div className={iconBox}>
                  {isDark ? <Moon size={16} className="text-cyan-400" /> : <Sun size={16} className="text-yellow-500" />}
                </div>
                <span className="font-medium flex-1">{isDark ? t.darkMode : t.lightMode}</span>
                <div className={`relative w-11 h-6 rounded-full transition-colors ${isDark ? 'bg-cyan-500' : 'bg-gray-300'}`}>
                  <div className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ease-out ${isDark ? 'translate-x-5' : 'translate-x-0'}`} />
                </div>
              </button>

              {/* Language */}
              <p className={`mt-4 mb-2 text-[11px] font-semibold uppercase tracking-wide ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                {t.language}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {reading.options.map((opt) => {
                  const active = reading.choice === opt.code;
                  return (
                    <button
                      key={opt.code}
                      title={opt.label}
                      onClick={() => reading.choose(opt.code)}
                      className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                        active
                          ? 'bg-cyan-500 text-white'
                          : isDark
                            ? 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                            : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <span className="truncate">{opt.label}</span>
                      {active && <Check size={14} className="shrink-0" />}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2">
                <TranslateNewsToggle isDark={isDark} />
              </div>


              <div className={`mt-6 pt-4 border-t ${isDark ? 'border-slate-700' : 'border-gray-100'}`}>
                <FooterCompact />
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
