import type { ReactNode } from 'react';
import { useApp } from '../../contexts/AppContext';
import { SENTIMENT_COLOR } from '../ui/chartTheme';

/** Preview (A5/D4): the empty / error / not-found states. A drawn scene in the brand colours
 * plus one clear action, instead of an emoji and a grey sentence. */
export function FeedState({ tone = 'empty', title, body, action }: { tone?: 'empty' | 'error'; title: string; body?: string; action?: ReactNode }) {
  const { isDark } = useApp();
  const ink = isDark ? '#cbd5e1' : '#0b1f33';
  const paper = isDark ? '#1e293b' : '#ffffff';
  const accent = tone === 'error' ? SENTIMENT_COLOR.negative : 'var(--brand)';
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className="flex flex-col items-center px-6 py-16 text-center">
      <svg width="168" height="120" viewBox="0 0 168 120" aria-hidden="true" className="mb-6" style={{ color: accent }}>
        <rect x="30" y="18" width="96" height="84" rx="10" fill={paper} stroke={ink} strokeWidth="2.5" />
        <rect x="42" y="31" width="44" height="26" rx="4" fill="currentColor" opacity="0.18" />
        <path d="M42 66h72M42 76h72M42 86h48M94 33h20M94 43h20M94 53h14" stroke={ink} strokeWidth="2.5" strokeLinecap="round" opacity="0.55" />
        {tone === 'error'
          ? <g><circle cx="128" cy="30" r="17" fill="currentColor" /><path d="M128 21v11M128 38v1" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" /></g>
          : <g><circle cx="126" cy="86" r="17" fill={paper} stroke="currentColor" strokeWidth="3" /><path d="m138 98 12 12" stroke="currentColor" strokeWidth="4" strokeLinecap="round" /></g>}
      </svg>
      <p className={`text-lg font-bold text-slate-900 dark:text-slate-100`}>{title}</p>
      {body && <p className={`mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400`}>{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

