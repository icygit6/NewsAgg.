import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Eye, EyeOff, KeyRound, CheckCircle2 } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { authService } from '../services/authService';
import { AuthLayout } from '../components/auth/AuthLayout';

export function ResetPasswordPage() {
  const { isDark } = useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const inputClass = `w-full px-4 py-3 rounded-xl border transition ${
    isDark
      ? 'bg-slate-800 border-slate-700 text-slate-100 placeholder-slate-500 focus:border-cyan-500'
      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-cyan-500'
  } focus:outline-none`;

  const handleSubmit = async () => {
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    setError('');
    const res = await authService.resetPassword(token, password);
    setLoading(false);
    if (res.success) {
      setDone(true);
    } else {
      setError(res.error || 'Could not reset your password. The link may have expired.');
    }
  };

  if (!token) {
    return (
      <AuthLayout title="Reset password" isDark={isDark}>
        <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
          This password reset link is missing or invalid. Request a new one from the sign-in screen.
        </p>
        <Link
          to="/"
          className="mt-5 inline-block text-sm font-medium text-cyan-500 hover:text-cyan-400"
        >
          ← Back to NewsAgg
        </Link>
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout title="Password reset" isDark={isDark}>
        <div className="flex flex-col items-center text-center gap-3">
          <CheckCircle2 size={44} className="text-emerald-500" />
          <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
            Your password has been reset. You can now sign in with your new password.
          </p>
          <button
            onClick={() => navigate('/')}
            className="mt-2 w-full px-5 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-pink-500 text-white font-semibold hover:from-cyan-600 hover:to-pink-600 transition-all shadow-lg shadow-cyan-500/20"
          >
            Go to sign in
          </button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Choose a new password" isDark={isDark}>
      <div className="space-y-4">
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            name="new-password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New password"
            className={`${inputClass} pr-11`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((p) => !p)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className={`absolute right-3.5 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-gray-400 hover:text-gray-600'}`}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <input
          type={showPassword ? 'text' : 'password'}
          name="confirm-password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirm new password"
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          className={inputClass}
        />
      </div>

      {error && (
        <div className={`mt-4 p-3 rounded-lg text-sm ${isDark ? 'bg-red-900/30 text-red-300' : 'bg-red-50 text-red-700'}`}>
          {error}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="mt-5 w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-pink-500 text-white font-semibold hover:from-cyan-600 hover:to-pink-600 transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <KeyRound size={18} />
        {loading ? 'Resetting…' : 'Reset password'}
      </button>
    </AuthLayout>
  );
}
