import { useUiText } from '../i18n/uiText';
import { useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { authService } from '../services/authService';
import { AuthLayout } from '../components/auth/AuthLayout';
import { LoadingIndicator } from '../components/ui/ContentSkeleton';

export function ResetPasswordPage() {
  const ui = useUiText();
  const { isDark, setSidebarOpen, setUser } = useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);

  const inputClass = `w-full px-4 py-3 rounded-xl border transition ${
    isDark
      ? 'bg-slate-800 border-slate-700 text-slate-100 placeholder-slate-500 focus:border-blue-500'
      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500'
  } focus:outline-none`;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting.current) return;
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    submitting.current = true;
    setError('');
    try {
    const res = await authService.resetPassword(token, password);
    if (res.success) {
      // A reset verifies inbox ownership on the server. Clear any stale
      // pre-reset session/profile and take the user straight to fresh sign-in.
      authService.logout();
      setUser(null);
      navigate('/', { replace: true });
      setSidebarOpen(true);
    } else {
      setError(res.error || 'Could not reset your password. The link may have expired.');
    }
    } catch {
      setError('Unable to connect. Please try again.');
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthLayout title={ui("Reset password")} isDark={isDark}>
        <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>{ui("This password reset link is missing or invalid. Request a new one from the sign-in screen.")} </p>
        <Link
          to="/"
          className="mt-5 inline-block text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
        >{ui("← Back to NewsAgg")} </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={ui("Choose a new password")} isDark={isDark}>
      <form onSubmit={handleSubmit} aria-busy={loading}>
      <fieldset disabled={loading}>
      <div className="space-y-4">
        <label htmlFor="reset-password" className="block text-sm font-semibold">{ui('New password')}</label>
        <div className="relative">
          <input
            id="reset-password"
            required
            minLength={8}
            type={showPassword ? 'text' : 'password'}
            name="new-password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={ui("New password")}
            className={`${inputClass} pr-11`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((p) => !p)}
            aria-label={showPassword ? ui("Hide password") : ui("Show password")}
            className={`absolute right-3.5 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-gray-400 hover:text-gray-600'}`}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">{ui('At least 8 characters')}</p>
        <label htmlFor="reset-confirm" className="block text-sm font-semibold">{ui('Confirm new password')}</label>
        <input
          id="reset-confirm"
          required
          type={showPassword ? 'text' : 'password'}
          name="confirm-password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder={ui("Confirm new password")}
          className={inputClass}
        />
      </div>

      {error && (
        <div role="alert" className={`mt-4 p-3 rounded-lg text-sm ${isDark ? 'bg-red-900/30 text-red-300' : 'bg-red-50 text-red-700'}`}>
          {ui(error)}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="auth-submit mt-5 w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? <LoadingIndicator label={ui('Resetting…')} /> : <><KeyRound size={18} />{ui('Reset password')}</>}
      </button>
      </fieldset>
      </form>
    </AuthLayout>
  );
}
