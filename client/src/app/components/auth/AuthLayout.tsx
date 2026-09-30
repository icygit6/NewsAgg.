import { useUiText } from '../../i18n/uiText';
import { ReactNode } from 'react';
import { Link } from 'react-router';
import { BrandLogo } from '../ui/BrandLogo';

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
      className={`min-h-screen flex flex-col items-center justify-center px-4 font-sans ${isDark ? 'text-slate-100' : 'text-slate-900'}`}
      style={{
        background: isDark
          ? 'radial-gradient(ellipse at 10% 20%, rgba(37, 99, 235, 0.10) 0%, transparent 50%), radial-gradient(ellipse at 85% 15%, rgba(23, 58, 99, 0.16) 0%, transparent 50%), #0a0f1e'
          : 'radial-gradient(ellipse at 10% 15%, rgba(37, 99, 235, 0.13) 0%, transparent 45%), radial-gradient(ellipse at 85% 10%, rgba(23, 58, 99, 0.08) 0%, transparent 45%), #f7f4ee',
      }}
    >
      <Link to="/" className="mb-6 flex items-center gap-2.5" aria-label={ui("NewsAgg home")}>
        <BrandLogo markClassName="w-10 h-10" wordmarkClassName="text-2xl" />
      </Link>

      <div
        className={`w-full max-w-sm rounded-2xl border shadow-xl p-6 ${
          isDark
            ? 'bg-slate-900/70 border-slate-700/60 backdrop-blur-md'
            : 'bg-white/85 border-white/60 backdrop-blur-md'
        }`}
      >
        <h1 className="font-poppins font-bold text-lg mb-4">{title}</h1>
        {children}
      </div>
    </div>
  );
}
