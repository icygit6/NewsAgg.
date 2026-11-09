import { useState } from 'react';
import { useUiText } from '../../i18n/uiText';
import { Flag, Loader2 } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { StyledSelect } from '../ui/StyledSelect';
import { button, fieldInput } from '../ui/styles';
import { authFetch } from '../../lib/apiFetch';

const REASONS = ['sentiment', 'topic', 'summary', 'translation', 'content', 'other'] as const;

/**
 * Reader correction route (report §V.5): flags a wrong label, summary,
 * translation or extraction for the team to review. It never edits the article.
 */
/* With `opened`, a parent (the article's ⋯ menu) decides when the form shows
 * and `onClose` hides it again; without it the component draws its own button. */
export function ReportIssue({ articleId, isDark, opened, onClose }: { articleId: string; isDark: boolean; opened?: boolean; onClose?: () => void }) {
  const { t, isAuthenticated, setSidebarOpen } = useApp();
  const ui = useUiText();
  const [ownOpen, setOwnOpen] = useState(false);
  const open = opened ?? ownOpen;
  const close = () => { setOwnOpen(false); onClose?.(); };
  const [reason, setReason] = useState<(typeof REASONS)[number]>('sentiment');
  const [message, setMessage] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');

  const submit = async () => {
    setState('sending');
    try {
      const response = await authFetch(`/api/articles/${articleId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, message: message.trim() }),
      });
      setState(response.ok ? 'sent' : 'failed');
      if (response.ok) setMessage('');
    } catch {
      setState('failed');
    }
  };

  const muted = 'text-slate-500 dark:text-slate-400';
  const field = `${fieldInput} resize-y`;

  if (!open) {
    if (opened !== undefined) return null;
    return (
      <button
        type="button"
        // Guests can read but not report; the button opens sign-in instead.
        onClick={() => { if (!isAuthenticated) { setSidebarOpen(true); return; } setOwnOpen(true); setState('idle'); }}
        className={button.secondary}
      >
        <Flag size={16} />{t.reportIssue}
      </button>
    );
  }

  return (
    <div className={`basis-full rounded-2xl border p-4 border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40`}>
      <p className={`text-sm font-semibold text-slate-900 dark:text-slate-100`}>{t.reportIssueTitle}</p>
      <p className={`mt-1 text-xs leading-relaxed ${muted}`}>{t.reportIssueHint}</p>
      {state === 'sent' ? (
        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-emerald-600">{t.reportSent}</p>
          {onClose && <button type="button" onClick={close} className={button.ghost}>{ui('Close')}</button>}
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <StyledSelect label={t.reportIssueTitle} value={reason} onChange={setReason} isDark={isDark} disabled={state === 'sending'} options={REASONS.map((value, index) => ({ value, label: t.reportReasons[index] }))} />
          <textarea
            value={message}
            maxLength={1000}
            rows={3}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={t.reportMessagePlaceholder}
            aria-label={t.reportMessagePlaceholder}
            className={field}
          />
          {state === 'failed' && <p className="text-xs font-medium text-red-600">{t.reportFailed}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={close} className={button.ghost}>
              {t.cancel}
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={state === 'sending'}
              className={button.primary}
            >
              {state === 'sending' && <Loader2 size={14} className="animate-spin" />}
              {t.reportSubmit}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
