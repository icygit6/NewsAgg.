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
export function AuthLayout({ title, children }: AuthLayoutProps) {
  const ui = useUiText();
  return (
    <div
      className={`auth-page min-h-screen flex flex-col items-center justify-center px-4 font-sans text-slate-900 dark:text-slate-100`}
      style={{
        background: 'var(--page-bg)',
      }}
    >
      <Link to="/" className="mb-6 flex items-center gap-2.5" aria-label={ui("NewsAgg home")}>
        <BrandLogo size="md" />
      </Link>

      <div
        className={`w-full max-w-sm rounded-2xl border shadow-xl p-6 bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800`}
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
