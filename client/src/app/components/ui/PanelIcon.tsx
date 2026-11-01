import type { LucideIcon } from 'lucide-react';

/** The icon tile at the head of every analytics panel (Sentiment Distribution, Live View,
 * Trending Topics, Live Engagement, Markets, ...). One component so they cannot drift apart:
 * each panel used to carry its own gradient. Solid, in the theme's primary colour. */
export function PanelIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[var(--brand)]">
      <Icon size={13} className="text-white" />
    </span>
  );
}
