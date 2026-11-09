import { useUiText } from '../../i18n/uiText';
import { useEffect, useId, useRef, useState } from 'react';
import { Eye, EyeOff, Info, LogIn, UserPlus, Mail, Check } from 'lucide-react';
import { getRuntimeConfig } from '../../lib/runtimeConfig';
import { useApp } from '../../contexts/AppContext';
import { authService } from '../../services/authService';
import { Turnstile } from '../auth/Turnstile';
import { LocalizedGoogleLogin } from '../auth/LocalizedGoogleLogin';
import { LoadingIndicator } from '../ui/ContentSkeleton';
import '../auth/auth.css';
import { errorBox } from '../ui/ErrorNote';

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
  const id = useId();
  const submitting = useRef(false);
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
  // Google renders its button in an iframe at a fixed pixel width; measure the
  // panel so the button lines up with the inputs at every drawer width.
  const googleSlot = useRef<HTMLDivElement>(null);
  const [googleWidth, setGoogleWidth] = useState(320);
  useEffect(() => {
    const el = googleSlot.current;
    if (!el) return;
    const measure = () => setGoogleWidth(Math.round(Math.min(400, Math.max(200, el.clientWidth))));
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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
    window.location.reload();
  };

  const handleGoogleSuccess = async (credentialResponse: any) => {
    if (submitting.current) return;
    submitting.current = true;
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
      submitting.current = false;
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

  const changeMode = (next: typeof mode) => {
    if (loading) return;
    setMode(next);
    setPassword('');
    setShowPassword(false);
    setError('');
    setInfo('');
    setPendingGoogleSignup(false);
    setGoogleCredential('');
    setTermsAccepted(false);
    setEmailUpdates(false);
    resetCaptcha();
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    try {
      await (mode === 'login' ? handleLogin() : mode === 'signup' ? handleSignup() : handleForgot());
    } catch {
      setError('Unable to connect. Please try again.');
      resetCaptcha();
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  };
  const inputClass = `auth-input w-full px-4 py-3 rounded-xl border transition bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-blue-500 focus:outline-none`;
  const labelClass = `block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300`;

  return (
    <section className="newsagg-auth" data-theme={isDark ? 'dark' : 'light'}>
      <header className="auth-welcome">
        <div className="min-w-0">
          <h3 className="text-lg font-bold leading-snug">{ui(mode === 'login' ? 'Welcome back.' : mode === 'signup' ? 'Make room for perspective.' : 'A fresh start.')}</h3>
          <p className="mt-0.5 text-xs leading-relaxed">{ui('Save stories, join discussions, and make your reading experience your own.')}</p>
        </div>
      </header>
      {mode !== 'forgot' && <div className="auth-mode" role="group" aria-label={ui('Account access')}>
        {(['login', 'signup'] as const).map(value => <button key={value} type="button" disabled={loading} aria-pressed={mode === value} onClick={() => changeMode(value)}>{ui(value === 'login' ? 'Sign in' : 'Create account')}</button>)}
      </div>}
      <form onSubmit={submit} aria-label={ui(mode === 'login' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Reset password')} aria-busy={loading}>
      <fieldset disabled={loading} className="min-w-0">

      <div className="space-y-4 mb-6">
        {mode === 'signup' && (
          <div>
            <label htmlFor={`${id}-username`} className={labelClass}>{ui("Username")}</label>
            <input
              id={`${id}-username`}
              required
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
          <label htmlFor={`${id}-email`} className={labelClass}>{ui("Email")}</label>
          <input
            id={`${id}-email`}
            required
            readOnly={pendingGoogleSignup}
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
            <label htmlFor={`${id}-password`} className={labelClass}>{ui("Password")}</label>
            <div className="relative">
              <input
                id={`${id}-password`}
                required
                minLength={mode === 'signup' ? 8 : undefined}
                aria-describedby={mode === 'signup' ? `${id}-password-help` : undefined}
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
                className={`absolute right-0.5 top-1/2 -translate-y-1/2 grid h-11 w-11 place-items-center rounded-xl text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200`}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {mode === 'signup' && <p id={`${id}-password-help`} className="mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400"><Check size={14} className={password.length >= 8 ? 'text-emerald-500' : 'opacity-40'} />{ui('At least 8 characters')}</p>}
            {mode === 'login' && (
              <div className="mt-2 text-right">
                <button
                  type="button"
                  onClick={() => changeMode('forgot')}
                  className={`min-h-11 text-xs font-medium transition ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 dark:text-blue-400 hover:text-blue-700'}`}
                >{ui("Forgot password?")} </button>
              </div>
            )}
          </div>
        )}

        {mode === 'forgot' && (
          <p className={`text-sm text-slate-600 dark:text-slate-400`}>{ui("Enter your email and we'll send you a link to reset your password.")} </p>
        )}
        {mode === 'signup' && (
          <div className="space-y-3">
            <label className={`flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300`}>
              <input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 dark:text-blue-400" />
              <span>{ui("I agree to the")} <a href="/terms" target="_blank" rel="noreferrer" className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">{ui("Terms of Service")}</a>. <span className="text-red-500">*</span></span>
            </label>
            <label className={`flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300`}>
              <input type="checkbox" checked={emailUpdates} onChange={(event) => setEmailUpdates(event.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 dark:text-blue-400" />
              <span>{ui("Yes, send me news and product updates by email. This is optional and can be changed in my profile.")}</span>
            </label>
          </div>
        )}
      </div>

      {info && !error && (
        <div role="status" className={`mb-4 p-3 rounded-lg flex items-start gap-2 text-sm bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200`}>
          <Info size={16} className="shrink-0 mt-0.5" />
          {ui(info)}
        </div>
      )}

      {error && (
        <div role="alert" className={`mb-4 ${errorBox}`}>
          {ui(error)}
        </div>
      )}

      {showCaptcha && (
        <Turnstile key={captchaKey} onToken={setCaptchaToken} isDark={isDark} />
      )}

      <button
        type="submit"
        disabled={loading}
        className="auth-submit w-full flex items-center justify-center gap-3 px-5 py-4 rounded-2xl text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed mb-4"
      >
        {loading ? <LoadingIndicator label={ui(mode === 'login' ? 'Signing in...' : mode === 'signup' ? 'Creating account...' : 'Sending...')} /> : <>{mode === 'login' ? <LogIn size={20} /> : mode === 'signup' ? <UserPlus size={20} /> : <Mail size={20} />}{ui(mode === 'login' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link')}</>}
      </button>
      </fieldset>
      </form>

      {googleAvailable && !captchaConfigured && (
        <p role="status" className={`mb-4 rounded-xl border p-3 text-center text-sm border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200`}>
          {ui("Google sign-in is temporarily unavailable until CAPTCHA is configured.")}
        </p>
      )}

      <div ref={googleSlot} className="w-full" aria-hidden="true" />
      {googleAvailable && captchaConfigured && !loading && !(mode === 'signup' && pendingGoogleSignup) && (
        <div className="mb-4">
          <div className="auth-divider" role="separator"><span>{ui('or')}</span></div>
          {captchaConfigured && !captchaToken ? (
            <p className={`rounded-xl border px-3 py-2.5 text-center text-xs leading-relaxed border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400`}>{ui("Complete the “I am not a robot” check above to continue with Google.")}</p>
          ) : (
            <div className="auth-google-surface flex justify-center">
            <LocalizedGoogleLogin
              // Recreate Google's iframe when its dimensions or theme change.
              key={`${googleWidth}-${isDark ? 'dark' : 'light'}-${mode}`}
              onSuccess={handleGoogleSuccess}
              onError={() =>
                setError(
                  'Google sign-in was blocked or cancelled. Allow pop-ups for this site, and make sure this app is authorized in Google Cloud (origin + test user).',
                )
              }
              theme={isDark ? 'filled_black' : 'outline'}
              // GSI's document uses a light browser color scheme even for filled_black.
              // A dark host scheme gives its transparent iframe gutters a white canvas.
              containerProps={{ className: 'auth-google-button', style: { colorScheme: 'light', maxWidth: '100%', background: 'transparent' } }}
              size="large"
              shape="pill"
              logo_alignment="center"
              width={googleWidth}
              text={mode === 'login' ? 'signin_with' : 'signup_with'}
            />
            </div>
          )}
        </div>
      )}

      <div className="text-center">
        {mode !== 'forgot' && (
          <p className={`text-sm text-slate-600 dark:text-slate-400 mb-2`}>
            {ui(mode === 'login' ? "Don't have an account?" : 'Already have an account?')}
          </p>
        )}
        <button
          type="button"
          disabled={loading}
          onClick={() => changeMode(mode === 'login' ? 'signup' : 'login')}
          className={`min-h-11 text-sm font-medium transition ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 dark:text-blue-400 hover:text-blue-700'}`}
        >
          {ui(mode === 'login' ? 'Create one' : mode === 'signup' ? 'Sign in' : '← Back to sign in')}
        </button>
      </div>
      <p className="mt-3 text-center text-xs text-slate-500 dark:text-slate-400"><a className="font-semibold text-[var(--brand)] hover:text-[var(--brand-hover)]" href="/privacy" target="_blank" rel="noreferrer">{ui('Privacy Policy')}</a></p>
    </section>
  );
}
