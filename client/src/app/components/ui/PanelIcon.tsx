import type { LucideIcon } from 'lucide-react';

/** The mark at the head of every panel that has no drawn InsightMark (article panels, Live
 * engagement). Drawn the same way as InsightMark: a line icon in the theme's primary colour on
 * a 32px box, no tile, so the article page and the analytics panels read as one set. */
export function PanelIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span aria-hidden="true" className="inline-flex h-8 w-8 shrink-0 items-center justify-center text-[var(--brand)]">
      <Icon size={20} strokeWidth={1.7} />
    </span>
  );
}
