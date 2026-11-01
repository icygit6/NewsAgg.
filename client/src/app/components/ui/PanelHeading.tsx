import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { PanelIcon } from './PanelIcon';

/** Card heading for article panels; uses the same icon tile as the analytics panels. */
export function PanelHeading({ icon: Icon, className = 'mb-4', children }: {
  icon: LucideIcon;
  isDark: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <h3 className={`font-poppins text-sm font-semibold flex items-center gap-2 text-slate-800 dark:text-slate-200 ${className}`}>
      <PanelIcon icon={Icon} />
      {children}
    </h3>
  );
}
