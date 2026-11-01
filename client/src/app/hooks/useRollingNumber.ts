import { useEffect, useLayoutEffect, useRef } from 'react';
import { animate, useReducedMotion } from 'motion/react';

interface Options {
  /** Turns the effect off and leaves the plain number (preview switch, tests). */
  enabled?: boolean;
  format?: (value: number) => string;
  duration?: number;
}

const plain = (value: number) => Math.round(value).toLocaleString();

/** Counts a number up when it first scrolls into view, and between values when it changes.
 * Writes textContent directly so React does not re-render on every frame; the rendered text
 * is always the final value, so without motion (or JS) the right number is shown. */
export function useRollingNumber<T extends HTMLElement = HTMLSpanElement>(value: number, { enabled = true, format = plain, duration = 0.9 }: Options = {}) {
  const ref = useRef<T>(null);
  const shown = useRef<number | null>(null);
  const reduced = useReducedMotion();
  const active = enabled && !reduced && Number.isFinite(value);
  const formatRef = useRef(format);
  formatRef.current = format;

  // Before the first paint, show 0 so the count-up has somewhere to start.
  useLayoutEffect(() => {
    if (active && shown.current === null && ref.current) ref.current.textContent = formatRef.current(0);
  }, [active]);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (!active) { element.textContent = formatRef.current(value); shown.current = value; return; }
    let controls: { stop: () => void } | undefined;
    const run = () => {
      const from = shown.current ?? 0;
      controls = animate(from, value, {
        duration,
        ease: [0.23, 1, 0.32, 1],
        onUpdate: (latest) => { shown.current = latest; element.textContent = formatRef.current(latest); },
        onComplete: () => { shown.current = value; },
      });
    };
    if (shown.current !== null || typeof IntersectionObserver === 'undefined') { run(); return () => controls?.stop(); }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) { observer.disconnect(); run(); }
    }, { threshold: 0.4 });
    observer.observe(element);
    return () => { observer.disconnect(); controls?.stop(); };
  }, [value, active, duration]);

  return ref;
}

export const percent = (decimals = 1) => (value: number) => `${value.toFixed(decimals)}%`;
