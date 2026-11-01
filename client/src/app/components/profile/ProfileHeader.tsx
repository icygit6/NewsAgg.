import { useUiText } from '../../i18n/uiText';
import { useRef, useState } from 'react';
import { CalendarDays, Clock3, Palette, Settings } from 'lucide-react';
import { Link } from 'react-router';
import { authService } from '../../services/authService';
import { useApp } from '../../contexts/AppContext';
import { useProfilePrivacy } from '../../hooks/useProfilePrivacy';
import { AvatarEditor } from './AvatarEditor';
import { PROFILE_BACKGROUNDS as BANNERS } from '../../lib/profileBackgrounds';
import { prepareBackground } from '../../lib/prepareBackground';

interface ProfileHeaderProps {
  isDark: boolean;
}

const formatDate = (value?: string) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString();
};

export function ProfileHeader({ isDark }: ProfileHeaderProps) {
  const ui = useUiText();
  const { t, user, setUser } = useApp();
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
  const actionBtn = `inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
    isDark ? 'border-slate-700 text-slate-200 hover:bg-slate-800' : 'border-slate-300 text-slate-700 hover:bg-slate-50'
  }`;
  const joined = formatDate(user.created_at);
  const lastLogin = formatDate(user.last_login);

  return (
    <div
      className={`rounded-3xl border shadow-sm ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white/95 border-slate-200'}`}
    >
      {/* Only the banner clips, so the avatar menu can overflow the card. */}
      <div className="h-28 sm:h-40 relative overflow-hidden rounded-t-3xl" style={{ background: banner }}>
        {user.profileBackgroundImage && <img src={user.profileBackgroundImage} alt={ui("Profile background")} className="absolute inset-0 w-full h-full object-cover" />}
        <button type="button" onClick={() => setEditing(!editing)} aria-expanded={editing}
          className="absolute right-3 top-3 flex items-center gap-2 rounded-xl border border-white/20 bg-black/45 px-3 py-2 text-xs font-semibold text-white backdrop-blur-md transition hover:bg-black/60">
          <Palette size={14} />{ui("Change background")} </button>
      </div>
      <div className="px-5 pb-5 sm:px-6 sm:pb-6">
        <div className="-mt-12 flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-5">
          <AvatarEditor isDark={isDark} />
          {/* The avatar overlaps the banner by 3rem; start the name just below it. */}
          <div className="min-w-0 pb-1 sm:pt-14">
            <h1 className={`font-poppins text-2xl font-bold leading-tight ${isDark ? 'text-slate-100' : 'text-slate-950'}`}>
              {user.displayName || user.username}
            </h1>
            <p className={`mt-0.5 text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>@{user.username}</p>
          </div>
          {/* One way out to /settings, which opens on the Profile section. */}
          <Link to="/settings" className={`${actionBtn} shrink-0 self-start sm:ml-auto sm:mt-14`}><Settings size={15} />{t.settings}</Link>
        </div>
        {user.bio && <p className={`mt-4 max-w-2xl text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{user.bio}</p>}
        {editing && <div className={`mt-5 rounded-2xl border p-4 ${isDark ? 'border-slate-700 bg-slate-950/40' : 'border-slate-200 bg-slate-50'}`} aria-label={ui("Background colours")}>
          <div className="w-full flex flex-wrap items-center gap-3">
            <button type="button" disabled={saving} onClick={() => fileInput.current?.click()} className="rounded-lg bg-blue-600 text-white px-3 py-2 text-xs disabled:opacity-50">{saving ? ui("Saving…") : ui("Upload image")}</button>
            {user.profileBackgroundImage && <button type="button" disabled={saving} onClick={() => void saveBackground(user.profileBackground ?? 0)} className="text-xs font-semibold hover:underline">{ui("Remove image")}</button>}
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
        <div className={`mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t pt-4 text-xs ${isDark ? 'border-slate-800 text-slate-400' : 'border-slate-100 text-slate-500'}`}>
            {joined && (
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays size={13} />
                {t.memberSince} {joined}
              </span>
            )}
            {lastLogin && (
              <span className="inline-flex items-center gap-1.5">
                <Clock3 size={13} />
                {t.lastActive} {hideLastActive ? '••••' : lastLogin}
              </span>
            )}
        </div>
      </div>
    </div>
  );
}
