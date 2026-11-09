import { Outlet } from 'react-router';
import { lazy, Suspense, useEffect, useState } from 'react';
import { useApp, useSidebarOpen } from '../contexts/AppContext';
import { AppShell } from '../components/shell/AppShell';
import { ScrollToTop } from '../components/ScrollToTop';
import { VerifyEmailBanner } from '../components/auth/VerifyEmailBanner';
import { DrawerSkeleton } from '../components/ui/ContentSkeleton';
import { LazyFeedbackHost } from '../components/feedback/LazyFeedbackHost';
import { Toaster } from 'sonner';
import { useDrawerHistory } from '../hooks/useDrawerHistory';

// Dev-only stress-data switch; `false &&` in the production build, so the
// chunk is never requested.
const DataModeToggle = lazy(() => import('../dev/DataModeToggle').then((m) => ({ default: m.DataModeToggle })));


const ProfileSidebar = lazy(() =>
  import('../components/ProfileSidebar').then((module) => ({ default: module.ProfileSidebar })),
);

export function Root() {
  const { isDark, setSidebarOpen, t } = useApp();
  const sidebarOpen = useSidebarOpen();
  const [hasOpenedSidebar, setHasOpenedSidebar] = useState(sidebarOpen);
  useDrawerHistory(sidebarOpen, setSidebarOpen);

  useEffect(() => {
    if (sidebarOpen) setHasOpenedSidebar(true);
  }, [sidebarOpen]);

  // Load and mount the drawer while the browser is idle (it renders nothing until opened), so
  // the first tap on Profile slides it in at once instead of fetching, evaluating and
  // mounting it in the middle of the animation.
  useEffect(() => {
    const load = () => { void import('../components/ProfileSidebar').then(() => setHasOpenedSidebar(true)); };
    if (typeof window.requestIdleCallback === 'function') {
      const handle = window.requestIdleCallback(load, { timeout: 4000 });
      return () => window.cancelIdleCallback(handle);
    }
    const timer = window.setTimeout(load, 2000);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div
      className={`h-dvh flex flex-col overflow-hidden font-sans text-slate-900 dark:text-slate-100`}
      style={{
        // Quiet canvas from the active colour theme; local components provide the hierarchy.
        background: 'var(--page-bg)',
      }}
    >
      <VerifyEmailBanner />

      <AppShell>
        <Outlet />
      </AppShell>

      {/* Global overlays */}
      {hasOpenedSidebar && (
        <Suspense fallback={<DrawerSkeleton label={t.loading} />}>
          <ProfileSidebar />
        </Suspense>
      )}
      <LazyFeedbackHost />
      {(
        <Toaster
          theme={isDark ? 'dark' : 'light'}
          position="bottom-right"
          closeButton={false}
          mobileOffset={{ bottom: 'calc(env(safe-area-inset-bottom) + 76px)' }}
          toastOptions={{ style: { zIndex: 130, fontFamily: 'inherit', borderRadius: '14px' } }}
        />
      )}
      <ScrollToTop />
      {import.meta.env.DEV && <Suspense fallback={null}><DataModeToggle /></Suspense>}
    </div>
  );
}
