import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Box that only renders its chart children once it has a measurable (>0) size.
 *
 * Recharts' `ResponsiveContainer` logs
 *   "The width(0) and height(0) of chart should be greater than 0…"
 * whenever it measures its parent at 0×0 — which happens while the element is
 * `display:none` (e.g. the right rail below the `lg` breakpoint, or an inactive
 * tab) or before first layout. Gating the children on a ResizeObserver keeps the
 * chart out of the tree until it can actually be drawn, and unmounts it again if
 * the box collapses back to zero. Use it as a drop-in for the fixed-height
 * wrapper that used to hold the `ResponsiveContainer` directly.
 */
export function ChartFrame({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setReady(width > 0 && height > 0);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={className}>
      {ready ? children : null}
    </div>
  );
}
