import { useUiText } from '../i18n/uiText';
import { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ArrowLeft, Link2, ShieldCheck, SlidersHorizontal, Trash2, UserPen } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { ListSkeleton } from '../components/ui/ContentSkeleton';
import { AuthUnavailable } from '../components/auth/AuthUnavailable';
import { EditProfileForm } from '../components/profile/EditProfileForm';
import { AccountSettings } from '../components/profile/AccountSettings';
import { ProfilePreferences } from '../components/profile/ProfilePreferences';
import { panel, segment } from '../components/ui/styles';

type SectionKey = 'profile' | 'security' | 'connections' | 'preferences' | 'delete';
const SECTIONS: SectionKey[] = ['profile', 'security', 'connections', 'preferences', 'delete'];

/** Account settings, split out of /profile so the profile page only shows the
 * profile. On phones the sections are a fixed row in the shared segment style,
 * like every other horizontal tab set; from md up they are a vertical list
 * styled like the nav rail. ?section= keeps a section linkable.
 * Signed-out visitors are sent home with the auth drawer open, like /profile. */
export function SettingsPage() {
  const ui = useUiText();
  const { t, isDark, user, setSidebarOpen, authInitialized, authUnavailable } = useApp();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const requested = params.get('section') as SectionKey | null;
  const active: SectionKey = requested && SECTIONS.includes(requested) ? requested : 'profile';

  useEffect(() => {
    // Could not reach the server: not the same as signed out, so stay and offer a retry.
    if (authInitialized && !authUnavailable && !user) {
      navigate('/');
      setSidebarOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authInitialized, authUnavailable, Boolean(user)]);

  if (!authInitialized) {
    return <div className="px-4 md:px-6 py-6 max-w-3xl mx-auto"><ListSkeleton label={ui("Loading settings")} /></div>;
  }
  if (!user) return authUnavailable ? <AuthUnavailable /> : null;

  // `short` is the phone label: five tabs have to fit one row without scrolling.
  const meta: Record<SectionKey, { label: string; short: string; icon: typeof UserPen; description?: string }> = {
    profile: { label: t.profile, short: t.profile, icon: UserPen, description: ui("How you appear on your profile and posts.") },
    security: { label: ui("Security"), short: ui("Security"), icon: ShieldCheck, description: ui("Your password and the devices signed in to your account.") },
    connections: { label: ui("Sign-in"), short: ui("Sign-in"), icon: Link2, description: ui("Ways you can sign in to NewsAgg.") },
    preferences: { label: ui("Preferences and privacy"), short: ui("Privacy"), icon: SlidersHorizontal, description: ui("Email from NewsAgg, and what this device shows.") },
    delete: { label: t.deleteAccount, short: ui("Delete"), icon: Trash2 },
  };
  // Phones: the segment track as a fixed five-column grid, icon over a short label.
  // md and up: the same buttons as a vertical list without the track.
  const track = segment.track.replace('inline-flex', 'grid grid-cols-5');
  const item = (selected: boolean) => (selected ? segment.active : segment.item).replace('px-3', 'px-1').replace('text-[13px]', 'text-[11px]');
  const current = meta[active];
  const choose = (key: SectionKey) => setParams(key === 'profile' ? {} : { section: key }, { replace: true });

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
      <Link to="/profile" className="inline-flex items-center gap-1.5 rounded-lg text-sm font-semibold text-[var(--brand)] hover:text-[var(--brand-hover)] dark:text-blue-400 dark:hover:text-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)]">
        <ArrowLeft size={16} />{ui("Back to profile")}
      </Link>
      <h1 className={`mt-2 font-poppins text-2xl font-bold text-slate-950 dark:text-slate-100`}>{t.settings}</h1>

      <div className="mt-5 grid gap-5 md:grid-cols-[13rem_minmax(0,1fr)] md:items-start">
        <nav aria-label={ui("Settings sections")}>
          <ul className={`${track} md:flex md:flex-col md:border-0 md:bg-transparent md:p-0 md:dark:bg-transparent`}>
            {SECTIONS.map((key) => {
              const { label, short, icon: Icon } = meta[key];
              const selected = key === active;
              return (
                <li key={key} className={`min-w-0 ${key === 'delete' ? 'md:mt-3' : ''}`}>
                  <button
                    type="button"
                    onClick={() => choose(key)}
                    aria-current={selected ? 'page' : undefined}
                    aria-label={label}
                    className={`flex min-h-12 w-full min-w-0 flex-col items-center justify-center gap-0.5 md:min-h-9 md:flex-row md:justify-start md:gap-2.5 md:rounded-xl md:px-3 md:py-2 md:text-sm ${item(selected)}`}
                  >
                    <Icon size={16} className="shrink-0" />
                    <span className="max-w-full truncate md:hidden">{short}</span>
                    <span className="hidden md:inline">{label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <section
          aria-labelledby="settings-section-title"
          className={`min-w-0 p-5 sm:p-7 ${panel}`}
        >
          <h2 id="settings-section-title" className={`font-poppins text-lg font-bold text-slate-900 dark:text-slate-100`}>{current.label}</h2>
          {current.description && <p className={`mt-1 text-sm text-slate-500 dark:text-slate-400`}>{current.description}</p>}
          <div className={`mt-5 border-t pt-6 border-slate-100 dark:border-slate-800`}>
            {active === 'profile' && <EditProfileForm />}
            {active === 'preferences' && <ProfilePreferences isDark={isDark} />}
            {(active === 'security' || active === 'connections' || active === 'delete') && <AccountSettings isDark={isDark} section={active} />}
          </div>
        </section>
      </div>
    </div>
  );
}
