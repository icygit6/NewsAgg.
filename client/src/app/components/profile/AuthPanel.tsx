import { useUiText } from '../../i18n/uiText';
import { useState } from 'react';
import { Eye, EyeOff, Info, LogIn, UserPlus, Mail } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { getRuntimeConfig } from '../../lib/runtimeConfig';
import { useApp } from '../../contexts/AppContext';
import { authService } from '../../services/authService';
import { Turnstile } from '../auth/Turnstile';

interface AuthPanelProps {
  isDark: boolean;
  /** Called after a successful sign-in/sign-up (e.g. to flip the drawer back). */
  onAuthenticated?: () => void;
}

/** Email + Google sign-in/sign-up forms (moved verbatim out of the old
 * 585-line ProfileSidebar so the drawer stays slim). */
export function AuthPanel({ isDark, onAuthenticated }: AuthPanelProps) {
  const ui = useUiText();
  const { t, setUser, language } = useApp();
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Informational guidance (e.g. "finish your Google signup") — rendered as a
  // calm info box, not an error, and cleared as soon as the user types.
  const [info, setInfo] = useState('');
  const [pendingGoogleSignup, setPendingGoogleSignup] = useState(false);
  const [googleCredential, setGoogleCredential] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [emailUpdates, setEmailUpdates] = useState(false);
  // CAPTCHA: the latest Turnstile token, whether login has tripped the adaptive
  // gate, and a key that remounts the widget for a fresh (single-use) token.
  const [captchaToken, setCaptchaToken] = useState('');
  const [loginCaptchaRequired, setLoginCaptchaRequired] = useState(false);
  const [captchaKey, setCaptchaKey] = useState(0);

  // Register + forgot always challenge; login only after repeated failures.
  const googleAvailable = Boolean(getRuntimeConfig().googleClientId) && mode !== 'forgot';
  const captchaConfigured = Boolean(getRuntimeConfig().turnstileSiteKey);
  const formCaptchaRequired = mode === 'signup' || mode === 'forgot' || (mode === 'login' && loginCaptchaRequired);
  // Google authentication is always preceded by a visible human check. Email
  // login remains adaptive, so showing this widget does not make it mandatory
  // for a normal password sign-in.
  const showCaptcha = captchaConfigured && (formCaptchaRequired || googleAvailable);

  const resetCaptcha = () => {
    setCaptchaToken('');
    setCaptchaKey((k) => k + 1);
  };

  const finish = () => {
    setEmail('');
    setUsername('');
    setPassword('');
    setError('');
    setInfo('');
    setGoogleCredential('');
    setPendingGoogleSignup(false);
    setTermsAccepted(false);
    setEmailUpdates(false);
    resetCaptcha();
    onAuthenticated?.();
  };

  const handleGoogleSuccess = async (credentialResponse: any) => {
    try {
      setLoading(true);
      setError('');
      setInfo('');
      const credential = credentialResponse.credential || '';
      if (!credential) {
        setError('Google authentication failed');
        return;
      }
      if (captchaConfigured && !captchaToken) {
        setError('Please complete the CAPTCHA before continuing with Google');
        return;
      }
      const result = await authService.loginWithGoogle(credential, captchaToken, false, false, language === 'zhTW' ? 'zhTW' : 'en');
      if (result.success && result.user) {
        authService.setUser(result.user);
        setUser(result.user);
        finish();
      } else if (result.needsSignup) {
        // Account doesn't exist yet — pre-fill signup from the Google profile.
        setPendingGoogleSignup(true);
        setGoogleCredential(credential);
        setEmail(result.email || '');
        setUsername(result.username || '');
        setMode('signup');
        setInfo(t.googleCompleteSignup);
        resetCaptcha();
      } else {
        setError(result.error || 'Google login failed');
      }
    } catch (err) {
      console.error('Google login error:', err);
      setError('Google authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    if (formCaptchaRequired && captchaConfigured && !captchaToken) {
      setError('Please complete the CAPTCHA');
      return;
    }
    setLoading(true);
    setError('');
    const result = await authService.login(email, password, captchaToken);
    if (result.success && result.user) {
      authService.setUser(result.user);
      setUser(result.user);
      finish();
    } else {
      setError(result.error || 'Login failed');
      // Server tells us once too many failures have tripped the adaptive gate.
      if (result.captchaRequired) setLoginCaptchaRequired(true);
      resetCaptcha(); // the token (if any) was single-use — get a fresh one
    }
    setLoading(false);
  };

  const handleForgot = async () => {
    if (!email) {
      setError('Please enter your email');
      return;
    }
    if (formCaptchaRequired && captchaConfigured && !captchaToken) {
      setError('Please complete the CAPTCHA');
      return;
    }
    setLoading(true);
    setError('');
    setInfo('');
    const result = await authService.forgotPassword(email, captchaToken);
    setLoading(false);
    resetCaptcha();
    if (result.success === false) {
      setError(result.error || 'Could not send reset link');
      return;
    }
    // Always a generic, non-enumerating confirmation from the server.
    setInfo(result.message || 'If an account exists for that email, a reset link is on its way.');
  };

  const handleSignup = async () => {
    if (!email || !username || (!pendingGoogleSignup && !password)) {
      setError('Please fill in all fields');
      return;
    }
    if (!pendingGoogleSignup && password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (!termsAccepted) {
      setError('You must agree to the Terms of Service');
      return;
    }
    if (captchaConfigured && !captchaToken) {
      setError('Please complete the CAPTCHA');
      return;
    }
    setLoading(true);
    setError('');
    const preferredLanguage = language === 'zhTW' ? 'zhTW' : 'en';
    const result = pendingGoogleSignup
      ? await authService.loginWithGoogle(googleCredential, captchaToken, true, emailUpdates, preferredLanguage)
      : await authService.register(email, username, password, captchaToken, true, emailUpdates, preferredLanguage);
    if (result.success && result.user) {
      authService.setUser(result.user);
      setUser(result.user);
      finish();
    } else {
      setError(result.error || 'Signup failed');
      resetCaptcha();
    }
    setLoading(false);
  };

  const inputClass = `w-full px-4 py-3 rounded-xl border transition ${
    isDark
      ? 'bg-slate-800 border-slate-700 text-slate-100 placeholder-slate-500 focus:border-cyan-500'
      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-cyan-500'
  } focus:outline-none`;
  const labelClass = `block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-gray-700'}`;

  return (
    <div>
      <h3 className={`font-bold text-lg mb-4 ${isDark ? 'text-slate-100' : 'text-gray-900'}`}>
        {mode === 'login' ? ui("Sign In") : mode === 'signup' ? 'Create Account' : 'Reset Password'}
      </h3>

      <div className="space-y-4 mb-6">
        {mode === 'signup' && (
          <div>
            <label className={labelClass}>{ui("Username")}</label>
            <input
              type="text"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={ui("your username")}
              className={inputClass}
            />
          </div>
        )}
        <div>
          <label className={labelClass}>{ui("Email")}</label>
          <input
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={inputClass}
          />
        </div>
        {mode !== 'forgot' && !pendingGoogleSignup && (
          <div>
            <label className={labelClass}>{ui("Password")}</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (info) setInfo('');
                }}
                placeholder="••••••••"
                className={`${inputClass} pr-11`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                aria-label={showPassword ? t.hidePassword : t.showPassword}
                title={showPassword ? t.hidePassword : t.showPassword}
                className={`absolute right-1.5 top-1/2 -translate-y-1/2 grid h-9 w-9 place-items-center rounded-full ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-gray-400 hover:text-gray-600'}`}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {mode === 'login' && (
              <div className="mt-2 text-right">
                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot');
                    setError('');
                    setInfo('');
                  }}
                  className={`text-xs font-medium transition ${isDark ? 'text-cyan-400 hover:text-cyan-300' : 'text-cyan-600 hover:text-cyan-700'}`}
                >{ui("Forgot password?")} </button>
              </div>
            )}
          </div>
        )}

        {mode === 'forgot' && (
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>{ui("Enter your email and we'll send you a link to reset your password.")} </p>
        )}
        {mode === 'signup' && (
          <div className="space-y-3">
            <label className={`flex items-start gap-3 text-sm ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
              <input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-300 text-cyan-600" />
              <span>{ui("I agree to the")} <a href="/terms" target="_blank" rel="noreferrer" className="font-semibold text-cyan-600 underline">{ui("Terms of Service")}</a>. <span className="text-red-500">*</span></span>
            </label>
            <label className={`flex items-start gap-3 text-sm ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
              <input type="checkbox" checked={emailUpdates} onChange={(event) => setEmailUpdates(event.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-300 text-cyan-600" />
              <span>{ui("Yes, send me news and product updates by email. This is optional and can be changed in my profile.")}</span>
            </label>
          </div>
        )}
      </div>

      {info && !error && (
        <div className={`mb-4 p-3 rounded-lg flex items-start gap-2 text-sm ${isDark ? 'bg-cyan-900/30 text-cyan-200' : 'bg-cyan-50 text-cyan-800'}`}>
          <Info size={15} className="shrink-0 mt-0.5" />
          {ui(info)}
        </div>
      )}

      {error && (
        <div className={`mb-4 p-3 rounded-lg ${isDark ? 'bg-red-900/30 text-red-300' : 'bg-red-50 text-red-700'}`}>
          {ui(error)}
        </div>
      )}

      {showCaptcha && (
        <Turnstile key={captchaKey} onToken={setCaptchaToken} isDark={isDark} />
      )}

      <button
        onClick={mode === 'login' ? handleLogin : mode === 'signup' ? handleSignup : handleForgot}
        disabled={loading}
        className="w-full flex items-center justify-center gap-3 px-5 py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-pink-500 text-white font-semibold hover:from-cyan-600 hover:to-pink-600 transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed mb-4"
      >
        {mode === 'login' ? <LogIn size={18} /> : mode === 'signup' ? <UserPlus size={18} /> : <Mail size={18} />}
        {ui(loading
          ? mode === 'login' ? 'Signing in...' : mode === 'signup' ? 'Creating account...' : 'Sending...'
          : mode === 'login' ? ui("Sign In") : mode === 'signup' ? 'Create Account' : 'Send reset link')}
      </button>

      {googleAvailable && !captchaConfigured && (
        <p role="status" className={`mb-4 rounded-xl border p-3 text-center text-sm ${isDark ? 'border-amber-800 bg-amber-950/30 text-amber-200' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
          {ui("Google sign-in is temporarily unavailable until CAPTCHA is configured.")}
        </p>
      )}

      {googleAvailable && captchaConfigured && !(mode === 'signup' && pendingGoogleSignup) && (
        <div className="mb-4">
          {captchaConfigured && !captchaToken ? (
            <p className={`rounded-xl border p-3 text-center text-sm ${isDark ? 'border-slate-700 text-slate-300' : 'border-slate-200 text-slate-600'}`}>{ui("Complete the “I am not a robot” check above to continue with Google.")}</p>
          ) : (
            <GoogleLogin
              key={language}
              onSuccess={handleGoogleSuccess}
              onError={() =>
                setError(
                  'Google sign-in was blocked or cancelled. Allow pop-ups for this site, and make sure this app is authorized in Google Cloud (origin + test user).',
                )
              }
              theme={isDark ? 'filled_black' : 'outline'}
              size="large"
              width="300"
              text={mode === 'login' ? 'signin_with' : 'signup_with'}
            />
          )}
        </div>
      )}

      <div className="text-center">
        {mode !== 'forgot' && (
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-600'} mb-2`}>
            {ui(mode === 'login' ? "Don't have an account?" : 'Already have an account?')}
          </p>
        )}
        <button
          onClick={() => {
            setMode(mode === 'login' ? 'signup' : mode === 'signup' ? 'login' : 'login');
            setError('');
            setInfo('');
            setPendingGoogleSignup(false);
            setGoogleCredential('');
            setTermsAccepted(false);
            setEmailUpdates(false);
            resetCaptcha();
          }}
          className={`text-sm font-medium transition ${isDark ? 'text-cyan-400 hover:text-cyan-300' : 'text-cyan-600 hover:text-cyan-700'}`}
        >
          {ui(mode === 'login' ? 'Create one' : mode === 'signup' ? 'Sign in' : '← Back to sign in')}
        </button>
      </div>
    </div>
  );
}
