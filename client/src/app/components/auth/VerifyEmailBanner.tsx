import { useState } from 'react';
import { MailWarning, X } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { authService } from '../../services/authService';

/** Soft, dismissible reminder shown to signed-in users whose email is not yet
 *  verified. Verification is never required to use the app — this only nudges. */
export function VerifyEmailBanner() {
  const { user } = useApp();
  const [dismissed, setDismissed] = useState(false);
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');

  // Only nudge when we positively know the email is unverified.
  if (!user || user.emailVerified !== false || dismissed) return null;

  const resend = async () => {
    setState('sending');
    const res = await authService.resendVerification();
    setState(res.success ? 'sent' : 'idle');
  };

  return (
    <div className="w-full bg-gradient-to-r from-cyan-500/95 to-pink-500/95 text-white text-sm">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-3">
        <MailWarning size={16} className="shrink-0" />
        <span className="flex-1 min-w-0">
          {state === 'sent'
            ? 'Verification email sent — check your inbox.'
            : 'Please verify your email address to secure your account.'}
        </span>
        {state !== 'sent' && (
          <button
            onClick={resend}
            disabled={state === 'sending'}
            className="shrink-0 font-semibold underline underline-offset-2 hover:opacity-90 disabled:opacity-60"
          >
            {state === 'sending' ? 'Sending…' : 'Resend'}
          </button>
        )}
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          title="Dismiss"
          className="shrink-0 p-1 rounded hover:bg-white/20"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
