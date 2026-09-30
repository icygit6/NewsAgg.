import { useUiText } from '../i18n/uiText';
import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useApp } from '../contexts/AppContext';
import { authService } from '../services/authService';
import { ProfileHeader } from '../components/profile/ProfileHeader';
import { AccountSettings } from '../components/profile/AccountSettings';
import { ProfileTabs } from '../components/profile/ProfileTabs';
import { ListSkeleton } from '../components/ui/ContentSkeleton';
import { ProfilePreferences } from '../components/profile/ProfilePreferences';

/** X-style account page: banner + avatar header, account settings and the
 * [My Posts | Bookmarks] tabs. Guarded: signed-out visitors are bounced home
 * with the auth drawer opened. */
export function ProfilePage() {
  const ui = useUiText();
  const { isDark, user, setUser, setSidebarOpen, authInitialized } = useApp();
  const navigate = useNavigate();

  // Guard + token validation: /me on mount refreshes the profile from the
  // server; a 401 fires the global sign-out, which re-triggers this guard.
  useEffect(() => {
    if (!authInitialized) return;
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
  }, [authInitialized, Boolean(user)]);

  if (!authInitialized) {
    return <div className="px-4 md:px-6 py-6 max-w-3xl mx-auto"><ListSkeleton label={ui("Loading profile")} /></div>;
  }
  if (!user) return null;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
      <ProfileHeader isDark={isDark} />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <AccountSettings isDark={isDark} />
        <div className="lg:sticky lg:top-5">
          <ProfilePreferences isDark={isDark} />
        </div>
      </div>
      <section aria-label={ui("Your content")} className={`rounded-3xl border p-4 shadow-sm sm:p-6 ${isDark ? 'border-slate-800 bg-slate-900/80' : 'border-slate-200 bg-white/95'}`}>
        <ProfileTabs isDark={isDark} />
      </section>
    </div>
  );
}
