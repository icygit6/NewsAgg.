import { useUiText } from '../../i18n/uiText';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Eye, EyeOff, KeyRound, Link2, Loader2, MonitorSmartphone, ShieldCheck, TriangleAlert, Unlink } from 'lucide-react';
import { LocalizedGoogleLogin } from '../auth/LocalizedGoogleLogin';
import { useApp } from '../../contexts/AppContext';
import { authService } from '../../services/authService';
import { getRuntimeConfig } from '../../lib/runtimeConfig';
import { errorText } from '../ui/ErrorNote';
import { LoadingIndicator } from '../ui/ContentSkeleton';

export type AccountSection = 'security' | 'connections' | 'delete';

interface AccountSettingsProps {
  isDark: boolean;
  section: AccountSection;
}

/** One /settings section: password and sessions, Google sign-in, or account
 * deletion. The settings page supplies the card and the section title. */
export function AccountSettings({ section }: AccountSettingsProps) {
  const ui = useUiText();
  const { t, user, setUser } = useApp();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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

  useEffect(() => {
    let active = true;
    authService.sessions().then((res) => {
      if (active && res.success) setSessions(res.sessions ?? []);
      if (active) setLoadingSessions(false);
    });
    return () => { active = false; };
  }, []);

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
      setConfirmPassword('');
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

  const panel = 'py-6 first:pt-0 last:pb-0';
  const heading = `text-sm font-semibold mb-4 flex items-center gap-2 text-slate-800 dark:text-slate-200`;
  const headingIcon = 'text-slate-400 dark:text-slate-500';
  const inputClass = `w-full px-4 py-2.5 rounded-xl border text-sm transition bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-blue-500 focus:outline-none`;
  const labelClass = `block text-xs font-medium mb-1.5 text-slate-500 dark:text-slate-400`;
  const primaryBtn =
    'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--brand)] text-white text-sm font-semibold hover:bg-[var(--brand-hover)] transition-all disabled:opacity-50';
  const msgClass = (ok: boolean) => `mt-2 text-xs ${ok ? 'text-emerald-500' : 'text-red-500'}`;

  return (
    <div className="min-w-0">
      {/* Password */}
      {section === 'security' && <div className={`divide-y divide-slate-100 dark:divide-slate-800`}>
      <div className={panel}>
        <h3 className={heading}><KeyRound size={14} className={headingIcon} />{t.changePassword}</h3>
        {user?.hasPassword === false ? <div className="space-y-3">
          <p className={`text-sm text-slate-600 dark:text-slate-300`}>{ui("You sign in with Google, so this account has no NewsAgg password yet. To add one, we email a single-use link to your address; opening it proves the inbox is yours.")}</p>
          <button onClick={() => void sendPasswordLink()} disabled={sendingLink} className={primaryBtn}>
            {sendingLink && <Loader2 size={14} className="animate-spin" />}
            {ui("Email me a link to set a password")}
          </button>
          {passwordMsg && <p role="status" aria-live="polite" className={msgClass(passwordMsg.ok)}>{ui(passwordMsg.text)}</p>}
        </div> : <div className="max-w-md space-y-3">
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
                className={`absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200`}
              >
                {showPasswords ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="confirm-new-password" className={labelClass}>{ui("Confirm new password")}</label>
            <input
              type={showPasswords ? 'text' : 'password'}
              id="confirm-new-password"
              name="confirm-new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={inputClass}
              autoComplete="new-password"
              aria-invalid={confirmPassword !== '' && confirmPassword !== newPassword}
              aria-describedby="confirm-new-password-hint"
            />
            {confirmPassword !== '' && confirmPassword !== newPassword && (
              <p id="confirm-new-password-hint" role="alert" className={`mt-1 text-xs ${errorText}`}>{ui("The new passwords do not match.")}</p>
            )}
          </div>
          <button
            onClick={savePassword}
            disabled={savingPassword || !currentPassword || newPassword.length < 8 || newPassword === currentPassword || confirmPassword !== newPassword}
            className={primaryBtn}
          >
            {savingPassword && <Loader2 size={14} className="animate-spin" />}
            {t.changePassword}
          </button>
          <p className={`text-xs text-slate-500 dark:text-slate-500`}>{ui("Enter your current password first. Use at least 8 characters, different from the current one. Changing it signs out every other session.")}</p>
          {passwordMsg && <p role="status" aria-live="polite" className={msgClass(passwordMsg.ok)}>{ui(passwordMsg.text)}</p>}
        </div>}
      </div>

      <div className={panel}>
        <h3 className={heading}><ShieldCheck size={14} className={headingIcon} />{ui("Security sessions")}</h3>
        {loadingSessions ? <LoadingIndicator label={ui("Loading sessions…")} /> : (
          <div className="space-y-2">
            {(sessions ?? []).map((session, index) => (
              <div key={`${session.createdAt}-${index}`} className={`flex items-start gap-3 rounded-xl border p-3 border-slate-200 dark:border-slate-700`}>
                <MonitorSmartphone size={16} className="mt-0.5 shrink-0 text-slate-400" />
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm font-medium text-slate-800 dark:text-slate-200`}>{ui(session.current ? 'This device' : 'Signed-in device')}</p>
                  <p className={`truncate text-xs text-slate-500 dark:text-slate-500`}>{session.userAgent || ui('Unknown browser')} · {session.ipAddress || ui('Unknown IP')}</p>
                </div>
              </div>
            ))}
            {(sessions?.length ?? 0) > 1 && <button type="button" onClick={() => void signOutOtherSessions()} className={primaryBtn}>{ui("Sign out other sessions")}</button>}
          </div>
        )}
        {sessionsMsg && <p role="status" aria-live="polite" className="mt-2 text-xs text-blue-600 dark:text-blue-400">{ui(sessionsMsg)}</p>}
      </div>

      </div>}

      {/* Delete account: plain section, the red is kept for the buttons. */}
      {section === 'delete' && <div className="max-w-md">
        <p className={`mb-4 flex gap-2 text-sm text-slate-600 dark:text-slate-300`}><TriangleAlert size={16} className="mt-0.5 shrink-0 text-red-500" />{t.deleteAccountWarning}</p>
        {!confirmingDelete ? (
          <button
            onClick={() => setConfirmingDelete(true)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors text-red-700 border-red-300 hover:bg-red-100 dark:text-red-300 dark:border-red-700/60 dark:hover:bg-red-900/30`}
          >
            {t.deleteAccount}
          </button>
        ) : (
          <div role="alertdialog" aria-labelledby="delete-account-title" aria-describedby="delete-account-description" className="space-y-3">
            <p id="delete-account-title" className={`text-sm font-semibold text-red-800 dark:text-red-200`}>{ui("Confirm permanent deletion")}</p>
            <p id="delete-account-description" className={`text-xs text-red-700 dark:text-red-300/80`}>{ui(user?.hasPassword ? 'Type DELETE and enter your current password to continue.' : 'Set a NewsAgg password above before deleting this account.')}</p>
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
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {deleting && <Loader2 size={14} className="animate-spin" />}
              {t.confirmDelete}
            </button>
            <button
              onClick={() => setConfirmingDelete(false)}
              disabled={deleting}
              className={`px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800`}
            >
              {t.cancel}
            </button>
            </div>
          </div>
        )}
        {deleteError && <p role="alert" className={`mt-2 text-xs ${errorText}`}>{ui(deleteError)}</p>}
      </div>}

      {/* Google sign-in connection (authentication only; no Gmail access). */}
      {section === 'connections' && <div>
        <h3 className={heading}><Link2 size={14} className={headingIcon} />{t.googleAccount}</h3>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className={`text-sm font-medium text-slate-800 dark:text-slate-200`}>
              {user?.googleLinked ? t.googleLinked : t.googleNotLinked}
            </p>
            <p className={`mt-1 text-xs text-slate-500 dark:text-slate-400`}>{ui("Authentication only. NewsAgg cannot read your Gmail messages or contacts.")} </p>
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
            className={`mt-3 inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800`}
          >
            <Unlink size={14} />{t.disconnectGoogle}
          </button>
        )}
        {user?.googleLinked && confirmingGoogleDisconnect && (
          <div className="mt-3">
            <p className={`mb-2 text-xs text-amber-700 dark:text-amber-300`}>
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
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {disconnectingGoogle && <Loader2 size={14} className="animate-spin" />}
                {t.disconnectGoogle}
              </button>
              <button type="button" onClick={() => setConfirmingGoogleDisconnect(false)} className={`px-3 py-2 text-sm text-slate-600 dark:text-slate-300`}>
                {t.cancel}
              </button>
            </div>
          </div>
        )}
        {googleMsg && <p role="status" aria-live="polite" className={msgClass(googleMsg.ok)}>{ui(googleMsg.text)}</p>}
      </div>}
    </div>
  );
}
