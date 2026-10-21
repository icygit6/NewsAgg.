import { useUiText } from '../../i18n/uiText';
import { useEffect, useState } from 'react';
import { AtSign, Clock3, Download, Languages, Loader2, Mail, Sparkles, Trash2 } from 'lucide-react';
import { mem0Service } from '../../services/mem0Service';
import { authService } from '../../services/authService';
import { useApp } from '../../contexts/AppContext';
import { useProfilePrivacy } from '../../hooks/useProfilePrivacy';
import { useInterfaceLanguage } from '../ui/LanguageSwitcher';
import { TranslateNewsToggle } from '../ui/TranslateNewsToggle';
import { StyledSelect } from '../ui/StyledSelect';

export function ProfilePreferences({ isDark }: { isDark: boolean }) {
  const ui = useUiText();
  const { t, user, setUser } = useApp();
  const reading = useInterfaceLanguage();
  const [enabled, setEnabled] = useState(true);
  const [topics, setTopics] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const [savingEmailUpdates, setSavingEmailUpdates] = useState(false);
  const [hideEmail, setHideEmail] = useProfilePrivacy('hideEmail');
  const [hideLastActive, setHideLastActive] = useProfilePrivacy('hideLastActive');

  useEffect(() => {
    let active = true;
    mem0Service.getUserPreferences().then((result) => {
      if (!active) return;
      setEnabled(result.enabled);
      setTopics(result.topics);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);


  const togglePersonalization = async () => {
    const next = !enabled;
    setMessage('');
    if (await mem0Service.setPersonalization(next)) {
      setEnabled(next);
      setMessage(next ? 'Personalization enabled.' : 'Personalization paused.');
    } else setMessage('Could not update personalization.');
  };

  const clearHistory = async () => {
    setMessage('');
    if (await mem0Service.clearReadingHistory()) {
      setTopics([]);
      setConfirmClear(false);
      setMessage('Personalization history cleared.');
    } else setMessage('Could not clear personalization history.');
  };

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

  const panel = `rounded-3xl border p-5 shadow-sm ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white/95 border-slate-200'}`;
  const row = `flex items-center gap-3 rounded-2xl p-3.5 ${isDark ? 'bg-slate-950/50 text-slate-200' : 'bg-slate-50 text-slate-800'}`;

  return (
    <section className={panel} aria-labelledby="preferences-heading">
      <h2 id="preferences-heading" className={`font-poppins text-base font-bold flex items-center gap-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}><Sparkles size={16} className="text-cyan-500" />{ui("Preferences and privacy")}</h2>
      <p className={`mb-4 mt-1 text-xs leading-relaxed ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>{ui("Manage how NewsAgg looks, learns, and contacts you.")}</p>
      <div className="space-y-3">
        <div className={row}>
          <Languages size={16} className="shrink-0 text-cyan-500" />
          <div className="min-w-0 flex-1">
            <span className="block text-sm font-medium">{t.language}</span>
          </div>
          <div className="w-32 shrink-0">
            <StyledSelect label={t.language} value={reading.choice} onChange={reading.choose} isDark={isDark} options={reading.options.map(({ code, short }) => ({ value: code, label: short }))} />
          </div>
        </div>
        <div className={`rounded-2xl p-0.5 ${isDark ? 'bg-slate-950/50' : 'bg-slate-50'}`}>
          <TranslateNewsToggle isDark={isDark} />
        </div>
        <button type="button" role="switch" aria-checked={Boolean(user?.emailUpdates)} disabled={savingEmailUpdates} onClick={() => void toggleEmailUpdates()} className={`${row} w-full text-left disabled:opacity-60`}>
          {savingEmailUpdates ? <Loader2 size={16} className="animate-spin text-cyan-500" /> : <Mail size={16} className="text-cyan-500" />}
          <span className="flex-1"><span className="block text-sm font-medium">{ui("Email updates")}</span><span className="block text-xs opacity-70">{ui("Receive product and news updates by email.")}</span></span>
          <span className="text-xs font-semibold">{user?.emailUpdates ? ui("On") : ui("Off")}</span>
        </button>
        <button type="button" role="switch" aria-checked={enabled} disabled={loading} onClick={() => void togglePersonalization()} className={`${row} w-full text-left disabled:opacity-60`}>
          {loading ? <Loader2 size={16} className="animate-spin text-cyan-500" /> : <Sparkles size={16} className="text-cyan-500" />}
          <span className="flex-1"><span className="block text-sm font-medium">{ui("Reading personalization")}</span><span className="block text-xs opacity-70">{ui("Learn topic preferences from articles you open.")}</span></span>
          <span className="text-xs font-semibold">{enabled ? ui("On") : ui("Off")}</span>
        </button>
        <p className={`pt-1 text-[11px] font-semibold uppercase tracking-wide ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{ui("Privacy")}</p>
        <p className={`-mt-1 text-xs leading-relaxed ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>{ui("Mask details on your own profile on this device, so the page is safe to screen-share.")}</p>
        <button type="button" role="switch" aria-checked={hideEmail} onClick={() => setHideEmail(!hideEmail)} className={`${row} w-full text-left`}>
          <AtSign size={16} className="shrink-0 text-cyan-500" />
          <span className="flex-1"><span className="block text-sm font-medium">{ui("Hide my email address")}</span><span className="block text-xs opacity-70">{ui("Show it as ab•••@example.com instead.")}</span></span>
          <span className="text-xs font-semibold">{hideEmail ? ui("On") : ui("Off")}</span>
        </button>
        <button type="button" role="switch" aria-checked={hideLastActive} onClick={() => setHideLastActive(!hideLastActive)} className={`${row} w-full text-left`}>
          <Clock3 size={16} className="shrink-0 text-cyan-500" />
          <span className="flex-1"><span className="block text-sm font-medium">{ui("Hide my last active date")}</span><span className="block text-xs opacity-70">{ui("Replace the date with dots.")}</span></span>
          <span className="text-xs font-semibold">{hideLastActive ? ui("On") : ui("Off")}</span>
        </button>
        {topics.length > 0 && <div><p className="mb-2 text-xs opacity-70">{ui("Inferred interests")}</p><div className="flex flex-wrap gap-2">{topics.map((topic) => <span key={topic} className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-600 dark:text-cyan-300">{topic}</span>)}</div></div>}
        <div className="flex flex-wrap gap-2">
          {!confirmClear ? (
            <button type="button" onClick={() => setConfirmClear(true)} className="inline-flex items-center gap-2 rounded-xl border border-rose-300 px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950/30"><Trash2 size={14} />{ui("Clear personalization history")}</button>
          ) : (
            <span className="inline-flex flex-wrap items-center gap-2 rounded-xl border border-rose-300 p-2 text-xs dark:border-rose-800">{ui("Clear inferred interests permanently?")} <button type="button" onClick={() => void clearHistory()} className="rounded-lg bg-rose-600 px-3 py-1.5 font-semibold text-white">{ui("Confirm clear")}</button>
              <button type="button" onClick={() => setConfirmClear(false)} className="px-2 py-1.5 font-medium">{ui("Cancel")}</button>
            </span>
          )}
          <button type="button" onClick={() => void downloadData()} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"><Download size={14} />{ui("Download my data")}</button>
        </div>
        {message && <p role="status" aria-live="polite" className="text-xs text-cyan-500">{ui(message)}</p>}
      </div>
    </section>
  );
}
