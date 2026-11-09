import { useUiText } from '../i18n/uiText';
import { motion, AnimatePresence, animate, useDragControls, useMotionValue, useReducedMotion, useTransform, type PanInfo } from 'motion/react';
import { X, LogOut, Bookmark, ChevronRight, Settings, ShieldCheck, MessageSquarePlus } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';
import { useApp, useSidebarOpen } from '../contexts/AppContext';
import { useBookmarks } from '../hooks/useBookmarks';
import { adminAttentionCount, useAdminAttention, useIsAdmin } from '../hooks/useAdmin';
import { openFeedback } from '../hooks/useFeedback';
import { useProfilePrivacy } from '../hooks/useProfilePrivacy';
import { authService } from '../services/authService';
import { AuthPanel } from './profile/AuthPanel';
import { maskEmail } from '../lib/maskEmail';
import { FooterCompact } from './shell/Footer';
import { useIsMobile } from './ui/use-mobile';
import { BrandLogo } from './ui/BrandLogo';
import { useInterfaceLanguage } from '../hooks/useInterfaceLanguage';
import { TranslateNewsToggle } from './ui/TranslateNewsToggle';
import { ThemePicker } from './ui/ThemePicker';
import { SegmentedControl } from './ui/SegmentedControl';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/** Slim account drawer: identity card linking to /profile plus quick
 * settings rows. All account editing lives on the /settings page. */
export function ProfileSidebar() {
  const ui = useUiText();
  const {
    setSidebarOpen, isDark, t, user, setUser,
    avatarSrc,
  } = useApp();
  const sidebarOpen = useSidebarOpen();
  const { bookmarks } = useBookmarks();
  const admin = useIsAdmin();
  const adminAttention = useAdminAttention();
  const openReports = adminAttentionCount(adminAttention.data);
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
    // preventScroll: the drawer is still off-screen at this point, and focusing it would otherwise scroll the page to bring it into view.
    drawer?.querySelector<HTMLElement>('button, a, input, [tabindex]:not([tabindex="-1"])')?.focus({ preventScroll: true });
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
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previousFocusRef.current?.focus({ preventScroll: true });
    };
  }, [sidebarOpen, setSidebarOpen]);

  // A drawer left open across a route change (browser back from a story) belongs to the page that is gone.
  const location = useLocation();
  const { pathname } = location;
  const lastPathname = useRef(pathname);
  useEffect(() => {
    if (lastPathname.current === pathname) return;
    lastPathname.current = pathname;
    setSidebarOpen(false);
  }, [pathname, setSidebarOpen]);

  // Each opening gets a session number; the body renders only after that session's slide-in has finished.
  const [wasOpen, setWasOpen] = useState(sidebarOpen);
  const [session, setSession] = useState(0);
  const [readySession, setReadySession] = useState(-1);
  if (sidebarOpen !== wasOpen) {
    setWasOpen(sidebarOpen);
    if (sidebarOpen) setSession(current => current + 1);
  }
  const bodyReady = readySession === session;

  const dragControls = useDragControls();
  const x = useMotionValue(0);
  const scrimOpacity = useTransform(x, value => Math.max(0, 1 - Math.abs(value) / 320));
  const leaving = useRef(false);
  // A fresh opening starts at rest; the layer unmounts on close, so this only clears the last swipe.
  useLayoutEffect(() => {
    if (!sidebarOpen) return;
    leaving.current = false;
    x.set(0);
  }, [sidebarOpen, x]);

  const startSwipe = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' || leaving.current) return;
    // Form controls and sliders keep their own horizontal gestures.
    if ((event.target as Element).closest('input, textarea, select, iframe, [role="slider"], [role="listbox"]')) return;
    dragControls.start(event);
  };
  const endSwipe = (_event: unknown, info: PanInfo) => {
    const toward = isMobile ? 1 : -1;
    const close = info.offset.x * toward > 90 || info.velocity.x * toward > 500;
    // Continue from where the finger let go, with its speed, instead of snapping back and re-sliding.
    const spring = { type: 'spring' as const, stiffness: 520, damping: 44, velocity: info.velocity.x, restDelta: 1, restSpeed: 10 };
    if (!close) { animate(x, 0, reducedMotion ? { duration: 0 } : spring); return; }
    leaving.current = true;
    const distance = toward * (drawerRef.current?.getBoundingClientRect().width ?? window.innerWidth);
    animate(x, distance, { ...(reducedMotion ? { duration: 0 } : spring), onComplete: () => setSidebarOpen(false) });
  };

  const goTo = (path: string) => {
    // Replace the entry the drawer pushed, so back from the new page lands where the drawer was opened.
    navigate(path, { replace: (location.state as { drawer?: boolean } | null)?.drawer === true });
    setSidebarOpen(false);
  };

  // Plain clicks on in-site links (the footer's) take the same path as the rows: close at once and replace the drawer's entry.
  const followLink = (event: React.MouseEvent) => {
    const link = (event.target as Element).closest<HTMLAnchorElement>('a[href]');
    if (!link || link.target || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const url = new URL(link.href);
    if (url.origin !== window.location.origin) return;
    event.preventDefault();
    goTo(`${url.pathname}${url.search}${url.hash}`);
  };

  const handleLogout = async () => {
    const result = await authService.logout();
    if (result.success) setUser(null);
  };

  const reading = useInterfaceLanguage();

  const rowClass = `w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800`;
  // Settings groups: a hairline above each, labelled like the profile page's Preferences card.
  const groupClass = `mt-5 pt-5 border-t border-slate-100 dark:border-slate-800`;
  const groupLabel = `mb-3 text-xs font-semibold text-slate-400 dark:text-slate-500`;
  const iconBox =`w-8 h-8 rounded-lg flex items-center justify-center bg-slate-100 dark:bg-slate-700`;

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
            style={{ viewTransitionName: 'account-drawer-scrim' }}
            className="fixed inset-0 z-[60]"
          >
            {/* The dimming layer follows the drag, so the page brightens as the drawer leaves. No backdrop blur:
                re-blurring the page on every frame is what made the slide stutter on phones. */}
            <motion.div style={{ opacity: scrimOpacity }} className="absolute inset-0 bg-black/40" />
          </motion.div>

          {/* Two layers: the outer one only slides in and out (a plain transform animation that
              runs on the compositor); the inner one is what a swipe drags. */}
          <motion.div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label={user ? t.account : t.signIn}
            initial={{ transform: `translateX(${isMobile ? '100%' : '-100%'})` }}
            animate={{ transform: 'translateX(0%)' }}
            exit={{ transform: `translateX(${isMobile ? '100%' : '-100%'})`, transition: { duration: reducedMotion ? 0 : 0.2, ease: [0.4, 0, 1, 1] } }}
            transition={{ duration: reducedMotion ? 0 : 0.3, ease: [0.32, 0.72, 0, 1] }}
            // The body mounts once the slide has landed, so rendering it never competes with the animation.
            onAnimationComplete={() => { if (sidebarOpen) setReadySession(session); }}
            // Named so a story image morphing back into the feed stays beneath the drawer instead of painting over it.
            style={{ viewTransitionName: 'account-drawer', willChange: 'transform' }}
            className={`account-drawer fixed inset-y-0 z-[70] w-full sm:w-[400px] sm:max-w-[95vw] ${isMobile ? 'right-0' : 'left-0'}`}
          >
          <motion.div
            // Swipe back toward the edge it came from to close (touch and pen only; a mouse keeps selecting text).
            drag="x"
            dragListener={false}
            dragControls={dragControls}
            dragDirectionLock
            // Held at 0 on the side it can't go, 1:1 with the finger on the closing side; release is animated by endSwipe, not by inertia.
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={isMobile ? { left: 0, right: 1 } : { left: 1, right: 0 }}
            dragMomentum={false}
            onPointerDown={startSwipe}
            onDragEnd={endSwipe}
            style={{ x, willChange: 'transform' }}
            className={`touch-pan-y flex h-full flex-col overflow-hidden pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] shadow-2xl ${
              isMobile ? 'sm:rounded-l-[28px]' : 'rounded-r-[28px]'
            } bg-white dark:bg-slate-900`}
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between px-6 py-5">
              <div className="flex items-center gap-2">
                <BrandLogo
                  size="sm"
                />
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                aria-label={ui("Close account panel")}
                className={`p-2 rounded-xl transition-colors text-slate-400 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800`}
              >
                <X size={20} />
              </button>
            </div>

            {/* touch-pan-y here too: a scroller restarts touch-action, so without it the browser claims sideways drags. */}
            <div onClickCapture={followLink} className="min-h-0 flex-1 touch-pan-y px-6 pb-6 overflow-y-auto no-scrollbar">
              {!bodyReady ? null : <div className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-150">
              {user ? (
                <>
                  {/* Identity card → /profile */}
                  <button
                    onClick={() => goTo('/profile')}
                    className={`w-full flex items-center gap-3 p-3 mb-4 rounded-2xl text-left transition-colors bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/70 dark:hover:bg-slate-800`}
                  >
                    <img src={avatarSrc} alt={user.username} className="w-12 h-12 rounded-full object-cover bg-slate-300" />
                    <div className="flex-1 min-w-0">
                      <p className={`font-poppins font-bold leading-tight truncate text-slate-900 dark:text-slate-100`}>
                        {user.username}
                      </p>
                      <p className={`text-xs truncate text-slate-500 dark:text-slate-400`}>{hideEmail ? maskEmail(user.email) : user.email}</p>
                      <span className="text-xs font-medium text-blue-600 dark:text-blue-400">{t.viewProfile}</span>
                    </div>
                    <ChevronRight size={16} className="text-slate-400 dark:text-slate-500" />
                  </button>

                  {/* Quick rows */}
                  <nav className="space-y-1">
                    <button onClick={() => goTo('/bookmarks')} className={rowClass}>
                      <div className={iconBox}><Bookmark size={16} className="text-blue-600 dark:text-blue-400" /></div>
                      <span className="font-medium flex-1">{t.bookmarks}</span>
                      <span className={`text-xs font-semibold text-slate-500 dark:text-slate-400`}>{bookmarks.length}</span>
                    </button>
                    <button onClick={() => goTo('/settings')} className={rowClass}>
                      <div className={iconBox}><Settings size={16} className="text-blue-600 dark:text-blue-400" /></div>
                      <span className="font-medium flex-1">{t.settings}</span>
                    </button>
                    {admin && (
                      <button onClick={() => goTo('/admin')} className={rowClass}>
                        <div className={iconBox}><ShieldCheck size={16} className="text-blue-600 dark:text-blue-400" /></div>
                        <span className="font-medium flex-1">{ui('Admin')}</span>
                        {openReports > 0 && <span className="rounded-full bg-red-500 px-1.5 text-[11px] font-bold leading-5 text-white">{openReports}</span>}
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
                className={`mt-6 flex w-full min-h-11 items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm transition-colors bg-slate-50 text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700`}
              >
                <MessageSquarePlus size={16} className="shrink-0 text-slate-500 dark:text-slate-400" />
                <span className="font-medium flex-1">{ui('Send feedback')}</span>
                <ChevronRight size={16} className="text-slate-400 dark:text-slate-500" />
              </button>

              <div className={`mt-6 pt-4 border-t border-slate-100 dark:border-slate-700`}>
                <FooterCompact brief />
              </div>
              </div>}
            </div>

            {/* Sign out */}
            {user && (
              <div className={`p-4 border-t border-slate-100 dark:border-slate-700`}>
                <button
                  onClick={() => void handleLogout()}
                  className={`w-full flex items-center gap-3 px-5 py-3.5 rounded-2xl font-semibold transition-all bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300 dark:border dark:border-red-700/50 dark:hover:bg-red-900/40`}
                >
                  <LogOut size={20} />
                  {t.signOut}
                </button>
              </div>
            )}
          </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
