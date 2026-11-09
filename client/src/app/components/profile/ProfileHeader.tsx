import { useUiText } from '../../i18n/uiText';
import { useRef, useState } from 'react';
import { CalendarDays, Clock3, Palette, Settings } from 'lucide-react';
import { Link } from 'react-router';
import { authService } from '../../services/authService';
import { useApp } from '../../contexts/AppContext';
import { useProfilePrivacy } from '../../hooks/useProfilePrivacy';
import { AvatarEditor } from './AvatarEditor';
import { button } from '../ui/styles';
import { PROFILE_BACKGROUNDS as BANNERS } from '../../lib/profileBackgrounds';
import { prepareBackground } from '../../lib/prepareBackground';
import { formatNewsDate } from '../../lib/formatDate';
import type { Language } from '../../i18n/translations';

// Interface-language dates (13 Oct 2026 / 2026/10/13), like the rest of the site.
const formatDate = (value: string | undefined, language: Language) => {
  if (!value || Number.isNaN(new Date(value).getTime())) return null;
  return formatNewsDate(value, language);
};

export function ProfileHeader() {
  const ui = useUiText();
  const { t, user, setUser, language } = useApp();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  // Owned by the privacy section of ProfilePreferences on /settings.
  const [hideLastActive] = useProfilePrivacy('hideLastActive');
  const fileInput = useRef<HTMLInputElement>(null);
  if (!user) return null;

  const banner = BANNERS[user.profileBackground ?? 0] ?? BANNERS[0];
  const saveBackground = async (background: number, image: string | null = null) => {
    setSaving(true);
    setMessage('');
    const result = await authService.updateBackground(background, image);
    if (result.success && result.user) {
      setUser(result.user);
      setMessage('Background saved');
      setEditing(false);
    } else setMessage(result.error || 'Could not save background');
    setSaving(false);
  };
  const uploadBackground = async (file?: File) => {
    if (!file) return;
    setSaving(true);
    setMessage('Preparing image…');
    try { await saveBackground(user.profileBackground ?? 0, await prepareBackground(file)); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not upload image'); }
    finally { setSaving(false); }
  };
  // Neutral: blue is kept for the page's main action (Write a post).
  const actionBtn = button.secondary;
  const joined = formatDate(user.created_at, language);
  const lastLogin = formatDate(user.last_login, language);

  return (
    <div
      className={`rounded-3xl border bg-white/95 border-slate-200 dark:bg-slate-900/80 dark:border-slate-800`}
    >
      {/* Only the banner clips, so the avatar menu can overflow the card. */}
      <div className="h-28 sm:h-40 relative overflow-hidden rounded-t-3xl" style={{ background: banner }}>
        {user.profileBackgroundImage && <img src={user.profileBackgroundImage} alt={ui("Profile background")} className="absolute inset-0 w-full h-full object-cover" />}
        <button type="button" onClick={() => setEditing(!editing)} aria-expanded={editing}
          className="absolute right-3 top-3 flex items-center gap-2 rounded-xl border border-white/20 bg-black/45 px-3 py-2 text-xs font-semibold text-white backdrop-blur-md transition hover:bg-black/60">
          <Palette size={14} />{ui("Change background")} </button>
      </div>
      <div className="px-5 pb-5 sm:px-6 sm:pb-6">
        <div className="relative -mt-12 flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-5">
          <AvatarEditor />
          {/* The avatar overlaps the banner by 3rem; start the name just below it. */}
          <div className="min-w-0 pb-1 sm:pt-14">
            <h1 className={`font-poppins text-2xl font-bold leading-tight text-slate-950 dark:text-slate-100`}>
              {user.displayName || user.username}
            </h1>
            <p className={`mt-0.5 text-sm font-medium text-slate-600 dark:text-slate-400`}>@{user.username}</p>
          </div>
          {/* One way out to /settings (opens on Profile), top right at every width:
              beside the avatar just under the banner on phones, level with the name from sm up. */}
          <Link to="/settings" className={`${actionBtn} absolute right-0 top-14 shrink-0 sm:static sm:ml-auto sm:mt-14 sm:self-start`}><Settings size={16} />{t.settings}</Link>
        </div>
        {user.bio && <p className={`mt-4 max-w-2xl text-sm leading-relaxed text-slate-700 dark:text-slate-300`}>{user.bio}</p>}
        {editing && <div className={`mt-5 rounded-2xl border p-4 border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950/40`} aria-label={ui("Background colours")}>
          <div className="w-full flex flex-wrap items-center gap-3">
            <button type="button" disabled={saving} onClick={() => fileInput.current?.click()} className="rounded-lg bg-blue-600 text-white px-3 py-2 text-xs disabled:opacity-50">{saving ? ui("Saving…") : ui("Upload image")}</button>
            {user.profileBackgroundImage && <button type="button" disabled={saving} onClick={() => void saveBackground(user.profileBackground ?? 0)} className="text-xs font-semibold hover:opacity-80">{ui("Remove image")}</button>}
            <p className="text-xs opacity-70">{ui("JPG, PNG or WebP · up to 10 MB · centre-cropped to 3:1")}</p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">{BANNERS.map((gradient, index) => <button key={gradient} type="button" disabled={saving}
            onClick={() => void saveBackground(index)} aria-label={`Background ${index + 1}`}
            aria-pressed={!user.profileBackgroundImage && (user.profileBackground ?? 0) === index}
            className={`h-9 w-14 rounded-lg border-2 shadow-sm disabled:opacity-40 ${!user.profileBackgroundImage && (user.profileBackground ?? 0) === index ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-white dark:border-slate-700'}`}
            style={{ background: gradient }} />)}</div>
        </div>}
        <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" aria-label={ui("Upload profile background")} className="hidden" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void uploadBackground(file); }} />
        {message && <p role="status" className="mt-3 text-xs">{ui(message)}</p>}
        <div className={`mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t pt-4 text-xs border-slate-100 text-slate-500 dark:border-slate-800 dark:text-slate-400`}>
            {joined && (
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays size={14} />
                {t.memberSince} {joined}
              </span>
            )}
            {lastLogin && (
              <span className="inline-flex items-center gap-1.5">
                <Clock3 size={14} />
                {t.lastActive} {hideLastActive ? '••••' : lastLogin}
              </span>
            )}
        </div>
      </div>
    </div>
  );
}
