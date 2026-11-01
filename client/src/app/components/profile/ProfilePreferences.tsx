import { useUiText } from '../../i18n/uiText';
import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { authService } from '../../services/authService';
import { useApp } from '../../contexts/AppContext';
import { useProfilePrivacy } from '../../hooks/useProfilePrivacy';
import { SwitchTrack } from '../ui/SwitchTrack';

/** Email and on-device privacy switches for /settings (the page supplies the card and title). Language and news translation live
 * in the account panel and the desktop nav, so they are not repeated here. */
export function ProfilePreferences({ isDark }: { isDark: boolean }) {
  const ui = useUiText();
  const { user, setUser } = useApp();
  const [message, setMessage] = useState('');
  const [savingEmailUpdates, setSavingEmailUpdates] = useState(false);
  const [hideEmail, setHideEmail] = useProfilePrivacy('hideEmail');
  const [hideLastActive, setHideLastActive] = useProfilePrivacy('hideLastActive');

  const downloadData = async () => {
    setMessage('');
    const result = await authService.exportData();
    if (!result.success || !result.data) {
      setMessage(result.error || 'Could not export account data.');
      return;
    }
    const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `newsagg-account-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage('Account export downloaded.');
  };

  const toggleEmailUpdates = async () => {
    const next = !user?.emailUpdates;
    setSavingEmailUpdates(true);
    setMessage('');
    const result = await authService.updatePreferences({ emailUpdates: next });
    setSavingEmailUpdates(false);
    if (result.success && result.user) {
      setUser(result.user);
      authService.setUser(result.user);
      setMessage(next ? 'Email updates enabled.' : 'Email updates disabled.');
    } else setMessage(result.error || 'Could not update email preferences.');
  };

  const row = `flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${isDark ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100'}`;
  const hint = `block text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`;
  const groupLabel = `px-3 pb-1 text-xs font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`;

  return (
    <div className="max-w-xl">
      <div className="-mx-3">
        <p className={groupLabel}>{ui("Email")}</p>
        <button type="button" role="switch" aria-checked={Boolean(user?.emailUpdates)} disabled={savingEmailUpdates} onClick={() => void toggleEmailUpdates()} className={`${row} disabled:opacity-60`}>
          <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{ui("Email updates")}</span><span className={hint}>{ui("Get the NewsAgg morning edition by email.")}</span>{user?.emailUpdates && user.emailVerified === false && <span className="mt-1 block text-xs text-amber-600 dark:text-amber-400">{ui("Verify your email first: the edition is only sent to verified addresses.")}</span>}</span>
          {savingEmailUpdates && <Loader2 size={14} className="shrink-0 animate-spin text-slate-400" />}
          <SwitchTrack on={Boolean(user?.emailUpdates)} isDark={isDark} />
        </button>

        <p className={`${groupLabel} pt-4`} title={ui("Mask details on your own profile on this device, so the page is safe to screen-share.")}>{ui("Privacy")} · {ui("this device")}</p>
        <button type="button" role="switch" aria-checked={hideEmail} onClick={() => setHideEmail(!hideEmail)} className={row}>
          <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{ui("Hide my email address")}</span><span className={hint}>{ui("Show it as ab•••@example.com instead.")}</span></span>
          <SwitchTrack on={hideEmail} isDark={isDark} />
        </button>
        <button type="button" role="switch" aria-checked={hideLastActive} onClick={() => setHideLastActive(!hideLastActive)} className={row}>
          <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{ui("Hide my last active date")}</span><span className={hint}>{ui("Replace the date with dots.")}</span></span>
          <SwitchTrack on={hideLastActive} isDark={isDark} />
        </button>
      </div>
      <div className={`mt-4 border-t pt-4 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
        <button type="button" onClick={() => void downloadData()} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"><Download size={14} />{ui("Download my data")}</button>
        {message && <p role="status" aria-live="polite" className="mt-2 text-xs text-blue-600 dark:text-blue-400">{ui(message)}</p>}
      </div>
    </div>
  );
}
