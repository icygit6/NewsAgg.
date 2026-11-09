import { useUiText } from '../i18n/uiText';
import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useApp } from '../contexts/AppContext';
import { authService } from '../services/authService';
import { ProfileHeader } from '../components/profile/ProfileHeader';
import { ProfileTabs } from '../components/profile/ProfileTabs';
import { ListSkeleton } from '../components/ui/ContentSkeleton';
import { AuthUnavailable } from '../components/auth/AuthUnavailable';

/** X-style account page: banner + avatar header and the [My Posts | Bookmarks]
 * tabs. Account settings live on /settings, linked from the header. Guarded:
 * signed-out visitors are bounced home with the auth drawer opened. */
export function ProfilePage() {
  const ui = useUiText();
  const { user, setUser, setSidebarOpen, authInitialized, authUnavailable } = useApp();
  const navigate = useNavigate();

  // Guard + token validation: /me on mount refreshes the profile from the
  // server; a 401 fires the global sign-out, which re-triggers this guard.
  useEffect(() => {
    // Could not reach the server: not the same as signed out, so stay and offer a retry.
    if (!authInitialized || authUnavailable) return;
    if (!user) {
      navigate('/');
      setSidebarOpen(true);
      return;
    }
    authService.me().then((res) => {
      if (res.success && res.user) {
        setUser(res.user);
        authService.setUser(res.user);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authInitialized, authUnavailable, Boolean(user)]);

  if (!authInitialized) {
    return <div className="px-4 md:px-6 py-6 max-w-3xl mx-auto"><ListSkeleton label={ui("Loading profile")} /></div>;
  }
  if (!user) return authUnavailable ? <AuthUnavailable /> : null;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
      <ProfileHeader />
      <section aria-label={ui("Your content")} className={`rounded-3xl border p-4 sm:p-6 border-slate-200 bg-white/95 dark:border-slate-800 dark:bg-slate-900/80`}>
        <ProfileTabs />
      </section>
    </div>
  );
}
