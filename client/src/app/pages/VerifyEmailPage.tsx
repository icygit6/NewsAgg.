import { useUiText } from '../i18n/uiText';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { CheckCircle2, XCircle } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { authService } from '../services/authService';
import { AuthLayout } from '../components/auth/AuthLayout';
import { LoadingIndicator } from '../components/ui/ContentSkeleton';

type Status = 'verifying' | 'success' | 'error';

export function VerifyEmailPage() {
  const ui = useUiText();
  const { isDark, user, setUser } = useApp();
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [status, setStatus] = useState<Status>(token ? 'verifying' : 'error');
  const [message, setMessage] = useState(
    token ? '' : 'This verification link is missing or invalid.'
  );
  // StrictMode double-invokes effects in dev; guard so the single-use token
  // isn't spent twice (the second call would then report "invalid").
  const ran = useRef(false);

  useEffect(() => {
    if (!token || ran.current) return;
    ran.current = true;
    authService.verifyEmail(token).then((res) => {
      if (res.success) {
        setStatus('success');
        setMessage(res.message || 'Your email has been verified. Thanks!');
        // Reflect the new state immediately if this user is signed in here.
        if (user && user.emailVerified === false) {
          const updated = { ...user, emailVerified: true };
          setUser(updated);
          authService.setUser(updated);
        }
      } else {
        setStatus('error');
        setMessage(res.error || 'This verification link is invalid or has expired.');
      }
    }).catch(() => {
      setStatus('error');
      setMessage('Unable to connect. Please try again.');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <AuthLayout title={ui("Email verification")} isDark={isDark}>
      <div className="flex flex-col items-center text-center gap-3">
        {status === 'verifying' && <LoadingIndicator label={ui('Verifying your email…')} />}
        {status === 'success' && <CheckCircle2 size={44} className="text-emerald-500" />}
        {status === 'error' && <XCircle size={44} className="text-red-500" />}
        {status !== 'verifying' && <p role={status === 'error' ? 'alert' : 'status'} className={`text-sm ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>{ui(message)}</p>}
        {status !== 'verifying' && (
          <Link
            to="/"
            className="mt-2 w-full px-5 py-3 rounded-2xl bg-[var(--brand)] text-white font-semibold hover:bg-[var(--brand-hover)] transition-all shadow-lg shadow-blue-600/20"
          >{ui("Continue to NewsAgg")} </Link>
        )}
      </div>
    </AuthLayout>
  );
}
