import { Outlet } from 'react-router';
import { lazy, Suspense, useEffect, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { AppShell } from '../components/shell/AppShell';
import { ScrollToTop } from '../components/ScrollToTop';
import { VerifyEmailBanner } from '../components/auth/VerifyEmailBanner';

const ProfileSidebar = lazy(() =>
  import('../components/ProfileSidebar').then((module) => ({ default: module.ProfileSidebar })),
);

export function Root() {
  const { isDark, sidebarOpen } = useApp();
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
        <Suspense fallback={null}>
          <ProfileSidebar />
        </Suspense>
      )}
      <ScrollToTop />
    </div>
  );
}
