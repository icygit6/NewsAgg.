import { Outlet } from 'react-router';
import { lazy, Suspense, useEffect, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { AppShell } from '../components/shell/AppShell';
import { ScrollToTop } from '../components/ScrollToTop';
import { VerifyEmailBanner } from '../components/auth/VerifyEmailBanner';
import { DrawerSkeleton } from '../components/ui/ContentSkeleton';
import { LazyFeedbackHost } from '../components/feedback/LazyFeedbackHost';
import { Toaster } from 'sonner';

// Dev-only stress-data switch; `false &&` in the production build, so the
// chunk is never requested.
const DataModeToggle = lazy(() => import('../dev/DataModeToggle').then((m) => ({ default: m.DataModeToggle })));


const ProfileSidebar = lazy(() =>
  import('../components/ProfileSidebar').then((module) => ({ default: module.ProfileSidebar })),
);

export function Root() {
  const { isDark, sidebarOpen, t } = useApp();
  const [hasOpenedSidebar, setHasOpenedSidebar] = useState(sidebarOpen);

  useEffect(() => {
    if (sidebarOpen) setHasOpenedSidebar(true);
  }, [sidebarOpen]);

  return (
    <div
      className={`h-dvh flex flex-col overflow-hidden font-sans ${isDark ? 'text-slate-100' : 'text-slate-900'}`}
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
