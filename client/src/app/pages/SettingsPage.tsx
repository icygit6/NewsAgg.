import { useUiText } from '../i18n/uiText';
import { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ArrowLeft, Link2, ShieldCheck, SlidersHorizontal, Trash2, UserPen } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { ListSkeleton } from '../components/ui/ContentSkeleton';
import { EditProfileForm } from '../components/profile/EditProfileForm';
import { AccountSettings } from '../components/profile/AccountSettings';
import { ProfilePreferences } from '../components/profile/ProfilePreferences';

type SectionKey = 'profile' | 'security' | 'connections' | 'preferences' | 'delete';
const SECTIONS: SectionKey[] = ['profile', 'security', 'connections', 'preferences', 'delete'];

/** Account settings, split out of /profile so the profile page only shows the
 * profile. A section list on the left (a scrolling row on phones) picks one
 * section at a time; ?section= keeps it linkable. Signed-out visitors are sent
 * home with the auth drawer open, like /profile. */
export function SettingsPage() {
  const ui = useUiText();
  const { t, isDark, user, setSidebarOpen, authInitialized } = useApp();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const requested = params.get('section') as SectionKey | null;
  const active: SectionKey = requested && SECTIONS.includes(requested) ? requested : 'profile';

  useEffect(() => {
    if (authInitialized && !user) {
      navigate('/');
      setSidebarOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authInitialized, Boolean(user)]);

  if (!authInitialized) {
    return <div className="px-4 md:px-6 py-6 max-w-3xl mx-auto"><ListSkeleton label={ui("Loading settings")} /></div>;
  }
  if (!user) return null;

  const meta: Record<SectionKey, { label: string; icon: typeof UserPen; description?: string }> = {
    profile: { label: t.profile, icon: UserPen, description: ui("How you appear on your profile and posts.") },
    security: { label: ui("Security"), icon: ShieldCheck, description: ui("Your password and the devices signed in to your account.") },
    connections: { label: ui("Sign-in"), icon: Link2, description: ui("Ways you can sign in to NewsAgg.") },
    preferences: { label: ui("Preferences and privacy"), icon: SlidersHorizontal, description: ui("Email from NewsAgg, and what this device shows.") },
    delete: { label: t.deleteAccount, icon: Trash2 },
  };
  const current = meta[active];
  const choose = (key: SectionKey) => setParams(key === 'profile' ? {} : { section: key }, { replace: true });

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
      <Link to="/profile" className={`inline-flex items-center gap-1.5 text-sm font-medium ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-900'}`}>
        <ArrowLeft size={15} />{ui("Back to profile")}
      </Link>
      <h1 className={`mt-2 font-poppins text-2xl font-bold ${isDark ? 'text-slate-100' : 'text-slate-950'}`}>{t.settings}</h1>

      <div className="mt-5 grid gap-5 md:grid-cols-[13rem_minmax(0,1fr)] md:items-start">
        <nav aria-label={ui("Settings sections")} className="-mx-4 overflow-x-auto px-4 md:mx-0 md:overflow-visible md:px-0" style={{ scrollbarWidth: 'none' }}>
          <ul className="flex gap-1 md:flex-col">
            {SECTIONS.map((key) => {
              const { label, icon: Icon } = meta[key];
              const selected = key === active;
              return (
                <li key={key} className={key === 'delete' ? 'md:mt-3' : undefined}>
                  <button
                    type="button"
                    onClick={() => choose(key)}
                    aria-current={selected ? 'page' : undefined}
                    className={`flex w-full items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                      selected
                        ? isDark ? 'bg-slate-800 font-semibold text-slate-100' : 'bg-white font-semibold text-slate-900 shadow-sm'
                        : key === 'delete'
                          ? 'text-rose-600 hover:bg-rose-500/10 dark:text-rose-400'
                          : isDark ? 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100' : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'
                    }`}
                  >
                    <Icon size={16} className="shrink-0 opacity-70" />{label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <section
          aria-labelledby="settings-section-title"
          className={`min-w-0 rounded-3xl border p-5 shadow-sm sm:p-7 ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white/95 border-slate-200'}`}
        >
          <h2 id="settings-section-title" className={`font-poppins text-lg font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{current.label}</h2>
          {current.description && <p className={`mt-1 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{current.description}</p>}
          <div className={`mt-5 border-t pt-6 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
            {active === 'profile' && <EditProfileForm isDark={isDark} />}
            {active === 'preferences' && <ProfilePreferences isDark={isDark} />}
            {(active === 'security' || active === 'connections' || active === 'delete') && <AccountSettings isDark={isDark} section={active} />}
          </div>
        </section>
      </div>
    </div>
  );
}
