import { Outlet } from 'react-router';
import { lazy, Suspense, useEffect, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { AppShell } from '../components/shell/AppShell';
import { ScrollToTop } from '../components/ScrollToTop';
import { VerifyEmailBanner } from '../components/auth/VerifyEmailBanner';
import { LoadingIndicator } from '../components/ui/ContentSkeleton';

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
        // Quiet neutral canvas; local components provide the hierarchy.
        background: isDark
          ? 'linear-gradient(180deg, #0b1220 0%, #0f172a 100%)'
          : 'linear-gradient(180deg, #f8fafc 0%, #f3f6fa 100%)',
      }}
    >
      <VerifyEmailBanner />

      <AppShell>
        <Outlet />
      </AppShell>

      {/* Global overlays */}
      {hasOpenedSidebar && (
        <Suspense fallback={<div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/30 backdrop-blur-sm"><div className="rounded-2xl bg-white px-6 py-4 text-slate-700 shadow-xl dark:bg-slate-900 dark:text-slate-200"><LoadingIndicator label={t.loading} /></div></div>}>
          <ProfileSidebar />
        </Suspense>
      )}
      <ScrollToTop />
      {import.meta.env.DEV && <Suspense fallback={null}><DataModeToggle /></Suspense>}
    </div>
  );
}
