import { useRollingNumber } from '../../hooks/useRollingNumber';

const plain = (value: number) => Math.round(value).toLocaleString();

/** A number that counts up into view. Renders the final value as text, so tests, screen readers
 * and reduced motion always get the real number. */
export function RollingNumber({ value, format = plain, className, duration }: { value: number; format?: (value: number) => string; className?: string; duration?: number }) {
  const ref = useRollingNumber<HTMLSpanElement>(value, { format, duration });
  return <span ref={ref} className={`tabular-nums ${className ?? ''}`}>{format(value)}</span>;
}
