import type { ReactNode } from 'react';

/** Full-width swipe/wheel strip; no reserved arrow lanes. */
export function CategoryScrollFrame({ children, className = '' }: {
  previous: ReactNode; next: ReactNode; children: ReactNode; className?: string;
}) {
  return <div className={`min-w-0 overflow-hidden ${className}`}>{children}</div>;
}
