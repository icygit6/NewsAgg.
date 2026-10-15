import { useState } from 'react';
import { Flag, Loader2 } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';

const API_BASE = import.meta.env.VITE_API_URL || '';
const REASONS = ['sentiment', 'topic', 'summary', 'translation', 'content', 'other'] as const;

/**
 * Reader correction route (report §V.5): flags a wrong label, summary,
 * translation or extraction for the team to review. It never edits the article.
 */
export function ReportIssue({ articleId, isDark }: { articleId: string; isDark: boolean }) {
  const { t } = useApp();
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
  const field = `w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-500/30 ${
    isDark ? 'border-slate-700 bg-slate-900 text-slate-100' : 'border-gray-200 bg-white text-gray-900'
  }`;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => { setOpen(true); setState('idle'); }}
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold ${isDark ? 'bg-slate-700 text-slate-100 hover:bg-slate-600' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}
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
          <select
            aria-label={t.reportIssueTitle}
            value={reason}
            onChange={(event) => setReason(event.target.value as (typeof REASONS)[number])}
            className={field}
          >
            {REASONS.map((code, index) => (
              <option key={code} value={code}>{t.reportReasons[index]}</option>
            ))}
          </select>
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
            <button type="button" onClick={() => setOpen(false)} className={`px-3 py-2 rounded-lg text-sm font-medium ${muted}`}>
              {t.cancel}
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={state === 'sending'}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-cyan-500 to-blue-500 disabled:opacity-60"
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
