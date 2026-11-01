import { useUiText } from '../../i18n/uiText';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { authService } from '../../services/authService';

/** Display name, username and bio: the Profile section of /settings. */
export function EditProfileForm({ isDark }: { isDark: boolean }) {
  const ui = useUiText();
  const { t, user, setUser } = useApp();
  const [username, setUsername] = useState(user?.username ?? '');
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    const publicResult = await authService.updatePublicProfile(displayName.trim() || null, bio.trim() || null);
    if (!publicResult.success || !publicResult.user) {
      setMsg({ ok: false, text: publicResult.error || 'Update failed' });
      setSaving(false);
      return;
    }
    let updatedUser = publicResult.user;
    if (username.trim() !== user?.username) {
      const usernameResult = await authService.updateProfile(username.trim());
      if (!usernameResult.success || !usernameResult.user) {
        setUser(updatedUser);
        authService.setUser(updatedUser);
        setMsg({ ok: false, text: usernameResult.error || 'Public profile saved, but username update failed' });
        setSaving(false);
        return;
      }
      updatedUser = usernameResult.user;
    }
    setUser(updatedUser);
    authService.setUser(updatedUser);
    setSaving(false);
    setMsg({ ok: true, text: t.profileUpdated });
  };

  const inputClass = `w-full px-4 py-2.5 rounded-xl border text-sm transition ${
    isDark
      ? 'bg-slate-800 border-slate-700 text-slate-100 placeholder-slate-500 focus:border-blue-500'
      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500'
  } focus:outline-none`;
  const labelClass = `block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-gray-500'}`;

  return (
    <form
      onSubmit={(event) => { event.preventDefault(); void save(); }}
      aria-label={t.editProfile}
      className="max-w-2xl"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label htmlFor="profile-display-name" className={labelClass}>{ui("Display name")}</label><input id="profile-display-name" value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={60} className={inputClass} /></div>
        <div><label htmlFor="profile-username" className={labelClass}>{t.usernameLabel}</label><input id="profile-username" name="username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} className={inputClass} maxLength={30} /></div>
      </div>
      <div className="mt-3"><label htmlFor="profile-bio" className={labelClass}>{ui("Public bio")}</label><textarea id="profile-bio" value={bio} onChange={e => setBio(e.target.value)} maxLength={240} rows={3} className={`${inputClass} resize-none`} /><p className="mt-1 text-right text-xs text-slate-400">{bio.length}/240</p></div>
      <div className="mt-3 flex items-center justify-end gap-3">
        {msg && <p role={msg.ok ? 'status' : 'alert'} aria-live="polite" className={`text-xs ${msg.ok ? 'text-emerald-500' : 'text-rose-500'}`}>{ui(msg.text)}</p>}
        <button
          type="submit"
          disabled={saving || username.trim().length < 3}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--brand)] text-white text-sm font-semibold hover:bg-[var(--brand-hover)] transition-all disabled:opacity-50"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          {t.saveChanges}
        </button>
      </div>
    </form>
  );
}
