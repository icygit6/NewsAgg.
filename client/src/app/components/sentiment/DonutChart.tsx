import { useReducedMotion } from 'motion/react';
import { useEffect, useState, type ReactNode } from 'react';
import { useUiText } from '../../i18n/uiText';

interface DonutSegment {
  name: string;
  value: number;
  color: string;
}

/** Lightweight, accessible donut for simple distributions. This avoids
 * shipping a full charting runtime for three static sentiment slices. */
export function DonutChart({ segments, size = 112, isDark = false, transitionKey, activeName, onActiveChange, center }: { activeName?: string | null; onActiveChange?: (name: string | null) => void; center?: ReactNode; segments: DonutSegment[]; size?: number | string; isDark?: boolean; transitionKey?: string }) {
  const ui = useUiText();
  const [internalActive, setInternalActive] = useState<string | null>(null);
  const active = activeName === undefined ? internalActive : activeName;
  const setActive = (name: string | null) => { setInternalActive(name); onActiveChange?.(name); };
  useEffect(() => setInternalActive(null), [transitionKey]);
  const reduceMotion = useReducedMotion();
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const circumference = 2 * Math.PI * 38;
  let cursor = 0;
  const arcs = segments.map(segment => {
    const length = total > 0 ? Math.max(0, segment.value) / total * circumference : 0;
    const offset = -cursor;
    cursor += length;
    return { ...segment, length, offset, angle: ((-offset + length / 2) / circumference) * Math.PI * 2 };
  });
  const label = total > 0
    ? segments.map((segment) => `${segment.name}: ${segment.value} (${Math.round(segment.value / total * 100)}%)`).join(', ')
    : 'No sentiment data';
  const selected = segments.find(segment => segment.name === active && segment.value > 0);

  return (
    <div className="flex min-w-0 flex-col items-center py-2">
      <div
        role="group"
        aria-label={label}
        className="relative grid select-none place-items-center"
        style={{ width: size, height: size }}
      >
        {/* Stable SVG arcs interpolate their existing boundaries to the next
            distribution. No remount, blank frame, or React render per frame. */}
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90 overflow-visible">
          {total === 0 && <circle cx="50" cy="50" r="38" fill="none" stroke={isDark ? '#334155' : '#e5e7eb'} strokeWidth="24" />}
          {arcs.map(arc => <circle key={arc.name} data-donut-segment={arc.name}
            role="img"
            aria-label={`${arc.name}: ${arc.value.toLocaleString()} (${total > 0 ? Math.round(arc.value / total * 100) : 0}%)`}
            onPointerEnter={event => { if (event.pointerType === 'mouse' && arc.value > 0) setActive(arc.name); }}
            onPointerLeave={event => { if (event.pointerType === 'mouse' && !onActiveChange) setActive(null); }}
            onPointerDown={event => event.preventDefault()}
            cx="50" cy="50" r="38" fill="none" stroke={arc.color}
            style={{
              cursor: 'default',
              strokeWidth: active === arc.name ? 30 : 24,
              transform: active === arc.name ? `translate(${Math.cos(arc.angle) * 5}px, ${Math.sin(arc.angle) * 5}px)` : 'translate(0px, 0px)',
              opacity: selected && selected.name !== arc.name ? 0.25 : 1,
              filter: active === arc.name ? `drop-shadow(0 0 1px ${arc.color}80)` : 'none',
              pointerEvents: arc.value > 0 ? 'stroke' : 'none',
              strokeDasharray: `${arc.length} ${circumference}`,
              strokeDashoffset: arc.offset,
              transition: reduceMotion ? 'none' : 'stroke-dasharray 650ms cubic-bezier(0.23,1,0.32,1), stroke-dashoffset 650ms cubic-bezier(0.23,1,0.32,1), opacity 150ms ease-out, transform 160ms ease, stroke-width 160ms ease, filter 160ms ease',
            }} />)}
        </svg>
      <div aria-live="polite" aria-atomic="true" style={selected ? { color: selected.color } : undefined} className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center text-xs leading-4">
        {center ?? (selected ? <><strong className="block max-w-[55%]">{selected.name} · {Math.round(selected.value / total * 100)}%</strong><span>{selected.value.toLocaleString()} {ui('articles')}</span></> : total === 0 ? <span>{ui('No sentiment data')}</span> : <><strong className="text-base tabular-nums">{total.toLocaleString()}</strong><span>{ui('articles')}</span></>)}
      </div>
      </div>
    </div>
  );
}
