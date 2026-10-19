import { useUiText } from '../../i18n/uiText';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Eye, EyeOff, KeyRound, Link2, Loader2, MonitorSmartphone, ShieldCheck, TriangleAlert, Unlink, UserPen } from 'lucide-react';
import { LocalizedGoogleLogin } from '../auth/LocalizedGoogleLogin';
import { useApp } from '../../contexts/AppContext';
import { authService } from '../../services/authService';
import { getRuntimeConfig } from '../../lib/runtimeConfig';

interface AccountSettingsProps {
  isDark: boolean;
}

/** Username, password and account-deletion forms for the /profile page. */
export function AccountSettings({ isDark }: AccountSettingsProps) {
  const ui = useUiText();
  const { t, user, setUser } = useApp();
  const navigate = useNavigate();

  const [username, setUsername] = useState(user?.username ?? '');
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);
  const [sendingLink, setSendingLink] = useState(false);

  const [googleMsg, setGoogleMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [disconnectingGoogle, setDisconnectingGoogle] = useState(false);
  const [confirmingGoogleDisconnect, setConfirmingGoogleDisconnect] = useState(false);
  const [disconnectPassword, setDisconnectPassword] = useState('');

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [sessions, setSessions] = useState<Awaited<ReturnType<typeof authService.sessions>>['sessions']>([]);
  const [sessionsMsg, setSessionsMsg] = useState('');
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [activeSection, setActiveSection] = useState<'profile' | 'security' | 'connections' | 'danger'>('profile');

  useEffect(() => {
    setUsername(user?.username ?? '');
    setDisplayName(user?.displayName ?? '');
    setBio(user?.bio ?? '');
  }, [user?.username, user?.displayName, user?.bio]);

  useEffect(() => {
    let active = true;
    authService.sessions().then((res) => {
      if (active && res.success) setSessions(res.sessions ?? []);
      if (active) setLoadingSessions(false);
    });
    return () => { active = false; };
  }, []);

  const saveProfile = async () => {
    setSavingProfile(true);
    setProfileMsg(null);
    const publicResult = await authService.updatePublicProfile(displayName.trim() || null, bio.trim() || null);
    if (!publicResult.success || !publicResult.user) {
      setProfileMsg({ ok: false, text: publicResult.error || 'Update failed' });
      setSavingProfile(false);
      return;
    }
    let updatedUser = publicResult.user;
    if (username.trim() !== user?.username) {
      const usernameResult = await authService.updateProfile(username.trim());
      if (!usernameResult.success || !usernameResult.user) {
        setUser(updatedUser);
        authService.setUser(updatedUser);
        setProfileMsg({ ok: false, text: usernameResult.error || 'Public profile saved, but username update failed' });
        setSavingProfile(false);
        return;
      }
      updatedUser = usernameResult.user;
    }
    setUser(updatedUser);
    authService.setUser(updatedUser);
    setProfileMsg({ ok: true, text: t.profileUpdated });
    setSavingProfile(false);
  };

  const sendPasswordLink = async () => {
    setSendingLink(true);
    setPasswordMsg(null);
    const res = await authService.requestPasswordLink();
    setPasswordMsg(res.success
      ? { ok: true, text: 'We emailed you a link to set your password. It expires in 30 minutes.' }
      : { ok: false, text: res.error || 'Could not send the link' });
    setSendingLink(false);
  };

  const savePassword = async () => {
    setSavingPassword(true);
    setPasswordMsg(null);
    const res = await authService.changePassword(currentPassword, newPassword);
    if (res.success) {
      setPasswordMsg({ ok: true, text: t.passwordChanged });
      setCurrentPassword('');
      setNewPassword('');
      if (user && !user.hasPassword) {
        const next = { ...user, hasPassword: true };
        setUser(next);
        authService.setUser(next);
      }
    } else {
      setPasswordMsg({ ok: false, text: res.error || 'Change failed' });
    }
    setSavingPassword(false);
  };

  const linkGoogle = async (credential?: string) => {
    if (!credential) return;
    setGoogleMsg(null);
    const res = await authService.linkGoogle(credential);
    if (res.success && res.user) {
      setUser(res.user);
      authService.setUser(res.user);
      setGoogleMsg({ ok: true, text: t.googleLinked });
    } else {
      setGoogleMsg({ ok: false, text: res.error || 'Could not link Google account' });
    }
  };

  const disconnectGoogle = async () => {
    setDisconnectingGoogle(true);
    setGoogleMsg(null);
    const res = await authService.disconnectGoogle(disconnectPassword);
    if (res.success) {
      const next = res.user ?? (user ? { ...user, googleLinked: false } : undefined);
      if (next) {
        setUser(next);
        authService.setUser(next);
      }
      setConfirmingGoogleDisconnect(false);
      setDisconnectPassword('');
      setGoogleMsg({ ok: true, text: t.googleNotLinked });
    } else {
      setGoogleMsg({ ok: false, text: res.error || 'Could not disconnect Google account' });
    }
    setDisconnectingGoogle(false);
  };

  const deleteAccount = async () => {
    setDeleting(true);
    setDeleteError('');
    const res = await authService.deleteAccount(deleteConfirmation, deletePassword);
    if (res.success) {
      authService.clearCachedUser();
      setUser(null);
      navigate('/');
    } else {
      setDeleteError(res.error || 'Delete failed');
      setDeleting(false);
    }
  };

  const signOutOtherSessions = async () => {
    setSessionsMsg('');
    const res = await authService.signOutOtherSessions();
    if (res.success) {
      setSessions((current) => current?.filter((session) => session.current));
      setSessionsMsg('Other sessions signed out.');
    } else {
      setSessionsMsg(res.error || 'Could not sign out other sessions.');
    }
  };

  const panel = `rounded-3xl border p-5 sm:p-6 shadow-sm ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white/95 border-slate-200'}`;
  const heading = `font-poppins text-sm font-semibold mb-4 flex items-center gap-2 ${isDark ? 'text-slate-200' : 'text-gray-800'}`;
  const inputClass = `w-full px-4 py-2.5 rounded-xl border text-sm transition ${
    isDark
      ? 'bg-slate-800 border-slate-700 text-slate-100 placeholder-slate-500 focus:border-cyan-500'
      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-cyan-500'
  } focus:outline-none`;
  const labelClass = `block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-gray-500'}`;
  const primaryBtn =
    'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-pink-500 text-white text-sm font-semibold hover:from-cyan-600 hover:to-pink-600 transition-all disabled:opacity-50';
  const msgClass = (ok: boolean) => `mt-2 text-xs ${ok ? 'text-emerald-500' : 'text-rose-500'}`;

  return (
    <div className="min-w-0 space-y-4">
      <div className={`rounded-2xl border p-1.5 ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white/90 border-slate-200'}`}>
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-4" role="tablist" aria-label={ui("Account settings")}>
          {([
            ['profile', ui('Profile'), UserPen],
            ['security', ui('Security'), ShieldCheck],
            ['connections', ui('Sign-in'), Link2],
            ['danger', ui('Danger zone'), TriangleAlert],
          ] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={activeSection === key}
              onClick={() => setActiveSection(key)}
              className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors sm:text-sm ${
                activeSection === key
                  ? 'bg-blue-600 text-white shadow-sm'
                  : isDark ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-100' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon size={15} />{label}
            </button>
          ))}
        </div>
      </div>

      {/* Username */}
      {activeSection === 'profile' && <div className={panel}>
        <h2 className={heading}><UserPen size={14} className="text-cyan-500" />{t.editProfile}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label htmlFor="profile-display-name" className={labelClass}>{ui("Display name")}</label><input id="profile-display-name" value={displayName} onChange={e=>setDisplayName(e.target.value)} maxLength={60} className={inputClass}/></div>
          <div><label htmlFor="profile-username" className={labelClass}>{t.usernameLabel}</label><input id="profile-username" name="username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} className={inputClass} maxLength={30} /></div>
        </div>
        <div className="mt-3"><label htmlFor="profile-bio" className={labelClass}>{ui("Public bio")}</label><textarea id="profile-bio" value={bio} onChange={e=>setBio(e.target.value)} maxLength={240} rows={3} className={`${inputClass} resize-none`}/><p className="mt-1 text-right text-[11px] text-slate-400">{bio.length}/240</p></div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={saveProfile}
            disabled={savingProfile || username.trim().length < 3}
            className={primaryBtn}
          >
            {savingProfile && <Loader2 size={14} className="animate-spin" />}
            {t.saveChanges}
          </button>
        </div>
        {profileMsg && <p role="status" aria-live="polite" className={msgClass(profileMsg.ok)}>{ui(profileMsg.text)}</p>}
      </div>}

      {/* Password */}
      {activeSection === 'security' && <>
      <div className={panel}>
        <h2 className={heading}><KeyRound size={14} className="text-cyan-500" />{t.changePassword}</h2>
        {user?.hasPassword === false ? <div className="space-y-3">
          <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{ui("You sign in with Google, so this account has no NewsAgg password yet. To add one, we email a single-use link to your address; opening it proves the inbox is yours.")}</p>
          <button onClick={() => void sendPasswordLink()} disabled={sendingLink} className={primaryBtn}>
            {sendingLink && <Loader2 size={14} className="animate-spin" />}
            {ui("Email me a link to set a password")}
          </button>
          {passwordMsg && <p role="status" aria-live="polite" className={msgClass(passwordMsg.ok)}>{ui(passwordMsg.text)}</p>}
        </div> : <div className="space-y-3">
          <div>
            <label htmlFor="current-password" className={labelClass}>{t.currentPassword}</label>
            <input
              type={showPasswords ? 'text' : 'password'}
              id="current-password"
              name="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={inputClass}
              autoComplete="current-password"
            />
          </div>
          <div>
            <label htmlFor="new-password" className={labelClass}>{t.newPassword}</label>
            <div className="relative">
              <input
                type={showPasswords ? 'text' : 'password'}
                id="new-password"
                name="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={inputClass}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPasswords((p) => !p)}
                aria-label={showPasswords ? t.hidePassword : t.showPassword}
                title={showPasswords ? t.hidePassword : t.showPassword}
                className={`absolute right-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-gray-400 hover:text-gray-600'}`}
              >
                {showPasswords ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
          <button
            onClick={savePassword}
            disabled={savingPassword || !currentPassword || newPassword.length < 8 || newPassword === currentPassword}
            className={primaryBtn}
          >
            {savingPassword && <Loader2 size={14} className="animate-spin" />}
            {t.changePassword}
          </button>
          <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>{ui("Enter your current password first. Use at least 8 characters, different from the current one. Changing it signs out every other session.")}</p>
          {passwordMsg && <p role="status" aria-live="polite" className={msgClass(passwordMsg.ok)}>{ui(passwordMsg.text)}</p>}
        </div>}
      </div>

      <div className={panel}>
        <h2 className={heading}><ShieldCheck size={14} className="text-cyan-500" />{ui("Security sessions")}</h2>
        {loadingSessions ? <p className={labelClass}>{ui("Loading sessions…")}</p> : (
          <div className="space-y-2">
            {(sessions ?? []).map((session, index) => (
              <div key={`${session.createdAt}-${index}`} className={`flex items-start gap-3 rounded-xl border p-3 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                <MonitorSmartphone size={16} className="mt-0.5 shrink-0 text-cyan-500" />
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{ui(session.current ? 'This device' : 'Signed-in device')}</p>
                  <p className={`truncate text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>{session.userAgent || ui('Unknown browser')} · {session.ipAddress || ui('Unknown IP')}</p>
                </div>
              </div>
            ))}
            {(sessions?.length ?? 0) > 1 && <button type="button" onClick={() => void signOutOtherSessions()} className={primaryBtn}>{ui("Sign out other sessions")}</button>}
          </div>
        )}
        {sessionsMsg && <p role="status" aria-live="polite" className="mt-2 text-xs text-cyan-500">{ui(sessionsMsg)}</p>}
      </div>
      </>}

      {/* Google sign-in connection (authentication only; no Gmail access). */}
      {activeSection === 'connections' && <div className={panel}>
        <h2 className={heading}><Link2 size={14} className="text-cyan-500" />{t.googleAccount}</h2>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
              {user?.googleLinked ? t.googleLinked : t.googleNotLinked}
            </p>
            <p className={`mt-1 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{ui("Authentication only. NewsAgg cannot read your Gmail messages or contacts.")} </p>
          </div>
          {!user?.googleLinked && getRuntimeConfig().googleClientId && (
            <div aria-label={t.linkGoogle}>
              <LocalizedGoogleLogin
                onSuccess={(response) => void linkGoogle(response.credential)}
                onError={() => setGoogleMsg({ ok: false, text: 'Google authentication failed' })}
                text="continue_with"
                shape="pill"
                size="medium"
              />
            </div>
          )}
        </div>
        {user?.googleLinked && !confirmingGoogleDisconnect && (
          <button
            type="button"
            onClick={() => setConfirmingGoogleDisconnect(true)}
            className={`mt-3 inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
              isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Unlink size={14} />{t.disconnectGoogle}
          </button>
        )}
        {user?.googleLinked && confirmingGoogleDisconnect && (
          <div className="mt-3">
            <p className={`mb-2 text-xs ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
              {user.hasPassword ? t.googleDisconnectWarning : ui('Set a NewsAgg password above before disconnecting Google.')}
            </p>
            <div className="flex gap-2">
              <div className="flex-1">
                <label htmlFor="disconnect-password" className={labelClass}>{t.currentPassword}</label>
                <input id="disconnect-password" type="password" autoComplete="current-password" value={disconnectPassword} onChange={(event) => setDisconnectPassword(event.target.value)} className={inputClass} />
              </div>
            </div>
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={disconnectGoogle}
                disabled={disconnectingGoogle || !user.hasPassword || !disconnectPassword}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {disconnectingGoogle && <Loader2 size={14} className="animate-spin" />}
                {t.disconnectGoogle}
              </button>
              <button type="button" onClick={() => setConfirmingGoogleDisconnect(false)} className={`px-3 py-2 text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                {t.cancel}
              </button>
            </div>
          </div>
        )}
        {googleMsg && <p role="status" aria-live="polite" className={msgClass(googleMsg.ok)}>{ui(googleMsg.text)}</p>}
      </div>}

      {/* Danger zone */}
      {activeSection === 'danger' && <div className={`rounded-3xl border p-5 sm:p-6 ${isDark ? 'bg-red-950/20 border-red-900/40' : 'bg-red-50/60 border-red-200'}`}>
        <h2 className={`font-poppins text-sm font-semibold mb-2 flex items-center gap-2 ${isDark ? 'text-red-300' : 'text-red-700'}`}>
          <TriangleAlert size={14} />{t.deleteAccount}
        </h2>
        <p className={`text-xs mb-3 ${isDark ? 'text-red-300/80' : 'text-red-600/90'}`}>{t.deleteAccountWarning}</p>
        {!confirmingDelete ? (
          <button
            onClick={() => setConfirmingDelete(true)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
              isDark
                ? 'text-red-300 border-red-700/60 hover:bg-red-900/30'
                : 'text-red-700 border-red-300 hover:bg-red-100'
            }`}
          >
            {t.deleteAccount}
          </button>
        ) : (
          <div role="alertdialog" aria-labelledby="delete-account-title" aria-describedby="delete-account-description" className="space-y-3">
            <p id="delete-account-title" className={`text-sm font-semibold ${isDark ? 'text-red-200' : 'text-red-800'}`}>{ui("Confirm permanent deletion")}</p>
            <p id="delete-account-description" className={`text-xs ${isDark ? 'text-red-300/80' : 'text-red-700'}`}>{ui(user?.hasPassword ? 'Type DELETE and enter your current password to continue.' : 'Set a NewsAgg password above before deleting this account.')}</p>
            <label htmlFor="delete-confirmation" className={labelClass}>{ui("Confirmation")}</label>
            <input id="delete-confirmation" value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} placeholder="DELETE" autoComplete="off" className={inputClass} />
            {user?.hasPassword && <>
              <label htmlFor="delete-password" className={labelClass}>{t.currentPassword}</label>
              <input id="delete-password" type="password" value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} autoComplete="current-password" className={inputClass} />
            </>}
            <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={deleteAccount}
              disabled={deleting || !user?.hasPassword || deleteConfirmation !== 'DELETE' || !deletePassword}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-rose-600 text-white hover:bg-rose-700 transition-colors disabled:opacity-50"
            >
              {deleting && <Loader2 size={14} className="animate-spin" />}
              {t.confirmDelete}
            </button>
            <button
              onClick={() => setConfirmingDelete(false)}
              disabled={deleting}
              className={`px-4 py-2 rounded-xl text-sm font-medium ${isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              {t.cancel}
            </button>
            </div>
          </div>
        )}
        {deleteError && <p role="alert" className="mt-2 text-xs text-rose-500">{ui(deleteError)}</p>}
      </div>}
    </div>
  );
}
