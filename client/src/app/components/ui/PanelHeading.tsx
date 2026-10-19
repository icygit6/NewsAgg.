import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

/** Card heading with the one icon treatment used across article panels. */
export function PanelHeading({ icon: Icon, isDark, className = 'mb-4', children }: {
  icon: LucideIcon;
  isDark: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <h3 className={`font-poppins text-sm font-semibold flex items-center gap-2 ${isDark ? 'text-slate-200' : 'text-gray-800'} ${className}`}>
      <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${isDark ? 'bg-cyan-500/15 text-cyan-300' : 'bg-cyan-50 text-cyan-600'}`}>
        <Icon size={14} aria-hidden="true" />
      </span>
      {children}
    </h3>
  );
}
