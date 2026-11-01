import { useUiText } from '../../i18n/uiText';
import { ReactNode } from 'react';
import { Link } from 'react-router';
import { BrandLogo } from '../ui/BrandLogo';
import './auth.css';

interface AuthLayoutProps {
  title: string;
  isDark: boolean;
  children: ReactNode;
}

/** Centered branded card used by the standalone /reset-password and
 *  /verify-email pages (rendered outside the main app shell). */
export function AuthLayout({ title, isDark, children }: AuthLayoutProps) {
  const ui = useUiText();
  return (
    <div
      className={`auth-page min-h-screen flex flex-col items-center justify-center px-4 font-sans ${isDark ? 'text-slate-100' : 'text-slate-900'}`}
      style={{
        background: 'var(--page-bg)',
      }}
    >
      <Link to="/" className="mb-6 flex items-center gap-2.5" aria-label={ui("NewsAgg home")}>
        <BrandLogo markClassName="w-10 h-10" wordmarkClassName="text-2xl" />
      </Link>

      <div
        className={`w-full max-w-sm rounded-2xl border shadow-xl p-6 ${
          isDark
            ? 'bg-slate-900 border-slate-800'
            : 'bg-white border-slate-200'
        }`}
      >
        <h1 className="font-poppins font-bold text-2xl mb-5 tracking-tight">{title}</h1>
        {children}
      </div>
      <nav className="mt-6 flex flex-wrap justify-center gap-5 text-sm" aria-label={ui('Account help')}>
        <Link className="font-semibold text-[var(--brand)] underline-offset-4 hover:underline" to="/">{ui('← Back to NewsAgg')}</Link>
        <Link className="font-semibold text-[var(--brand)] underline-offset-4 hover:underline" to="/privacy">{ui('Privacy Policy')}</Link>
      </nav>
    </div>
  );
}
