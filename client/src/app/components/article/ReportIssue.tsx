import { useState } from 'react';
import { Flag, Loader2 } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { StyledSelect } from '../ui/StyledSelect';
import { button, fieldInput } from '../ui/styles';

const API_BASE = import.meta.env.VITE_API_URL || '';
const REASONS = ['sentiment', 'topic', 'summary', 'translation', 'content', 'other'] as const;

/**
 * Reader correction route (report §V.5): flags a wrong label, summary,
 * translation or extraction for the team to review. It never edits the article.
 */
export function ReportIssue({ articleId, isDark }: { articleId: string; isDark: boolean }) {
  const { t, isAuthenticated, setSidebarOpen } = useApp();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number]>('sentiment');
  const [message, setMessage] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');

  const submit = async () => {
    setState('sending');
    try {
      const response = await fetch(`${API_BASE}/api/articles/${articleId}/report`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, message: message.trim() }),
      });
      setState(response.ok ? 'sent' : 'failed');
      if (response.ok) setMessage('');
    } catch {
      setState('failed');
    }
  };

  const muted = isDark ? 'text-slate-400' : 'text-gray-500';
  const field = `${fieldInput} resize-y`;

  if (!open) {
    return (
      <button
        type="button"
        // Guests can read but not report; the button opens sign-in instead.
        onClick={() => { if (!isAuthenticated) { setSidebarOpen(true); return; } setOpen(true); setState('idle'); }}
        className={button.secondary}
      >
        <Flag size={15} />{t.reportIssue}
      </button>
    );
  }

  return (
    <div className={`basis-full rounded-xl border p-4 ${isDark ? 'border-slate-700 bg-slate-900/40' : 'border-gray-200 bg-gray-50'}`}>
      <p className={`text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-gray-900'}`}>{t.reportIssueTitle}</p>
      <p className={`mt-1 text-xs leading-relaxed ${muted}`}>{t.reportIssueHint}</p>
      {state === 'sent' ? (
        <p className="mt-3 text-sm font-medium text-emerald-600">{t.reportSent}</p>
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
            <button type="button" onClick={() => setOpen(false)} className={button.ghost}>
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
