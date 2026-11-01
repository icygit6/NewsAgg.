import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useReducedMotion } from 'motion/react';
import { useApp } from '../../contexts/AppContext';

/** Native swipe pages, ten rows each. Automatic turns yield to the reader. */
export function AutoPages({ items, label, scopeKey, pageClassName = '' }: {
  items: ReactNode[]; label: string; scopeKey: string; pageClassName?: string;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { language } = useApp();
  const zh = language === 'zhTW' || language === 'zhCN';
  const count = Math.ceil(items.length / 10);
  const [page, setPage] = useState(0);
  const pageRef = useRef(0);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  pageRef.current = page;
  // Autoplay pauses while a mouse hovers or keyboard focus is inside the panel, while the
  // tab is hidden and while the panel is off screen, as in the hero carousel.
  const [paused, setPaused] = useState(false);
  const [tabHidden, setTabHidden] = useState(() => typeof document !== 'undefined' && document.hidden);
  const [offscreen, setOffscreen] = useState(false);
  // Bumped when the reader scrolls or taps the list, so the bar starts over: automatic turns yield to them.
  const [run, setRun] = useState(0);
  const autoplay = count > 1 && !reduced;
  const go = (index: number) => {
    const el = viewport.current;
    if (!el) return;
    el.scrollTo?.({ left: index * el.clientWidth, behavior: reduced ? 'instant' : 'smooth' });
  };
  useEffect(() => {
    setPage(0);
    setRun(r => r + 1);
    viewport.current?.scrollTo?.({ left: 0, behavior: 'instant' });
  }, [scopeKey, count]);
  useEffect(() => {
    const onVisibility = () => setTabHidden(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);
  useEffect(() => {
    const el = viewport.current;
    if (!el || !autoplay || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setOffscreen(!entry.isIntersecting), { threshold: 0.25 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [autoplay]);
  useEffect(() => {
    // The whole panel, heading included, counts as "reading it".
    const panel = root.current?.parentElement;
    if (!panel || !autoplay) return;
    // Hover pauses for a mouse only: on a touch screen "hover" sticks after a tap and would stop autoplay for good.
    const enter = (event: PointerEvent) => { if (event.pointerType === 'mouse') setPaused(true); };
    const leave = (event: PointerEvent) => { if (event.pointerType === 'mouse') setPaused(false); };
    const focusIn = () => setPaused(true);
    const focusOut = (event: FocusEvent) => { if (!panel.contains(event.relatedTarget as Node | null)) setPaused(false); };
    panel.addEventListener('pointerenter', enter);
    panel.addEventListener('pointerleave', leave);
    panel.addEventListener('focusin', focusIn);
    panel.addEventListener('focusout', focusOut);
    return () => {
      panel.removeEventListener('pointerenter', enter);
      panel.removeEventListener('pointerleave', leave);
      panel.removeEventListener('focusin', focusIn);
      panel.removeEventListener('focusout', focusOut);
    };
  }, [autoplay]);
  useEffect(() => {
    const el = viewport.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let width = el.clientWidth;
    const observer = new ResizeObserver(() => {
      if (width === el.clientWidth) return;
      width = el.clientWidth;
      el.scrollTo?.({ left: pageRef.current * width, behavior: 'instant' });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => () => clearTimeout(settleTimer.current), []);
  return <div ref={root} data-testid="auto-pages">
    <div ref={viewport} role="region" aria-label={label} tabIndex={0}
      className="no-scrollbar grid min-w-0 grid-flow-col auto-cols-[100%] snap-x snap-mandatory overflow-x-auto overflow-y-hidden rounded-xl focus-visible:outline-2 focus-visible:outline-[var(--brand)]"
      onPointerDown={() => setRun(r => r + 1)}
      onWheel={() => setRun(r => r + 1)}
      onScroll={event => {
        const el = event.currentTarget;
        clearTimeout(settleTimer.current);
        settleTimer.current = setTimeout(() => {
          if (el.clientWidth) setPage(Math.max(0, Math.min(count - 1, Math.round(el.scrollLeft / el.clientWidth))));
        }, 150);
      }}
      onKeyDown={event => { if (event.target !== event.currentTarget || count < 2) return; if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); go((page + (event.key === 'ArrowRight' ? 1 : count - 1)) % count); } }}>
      {Array.from({ length: count }, (_, index) => <div key={index} data-page={index} aria-hidden={page !== index || undefined}
        ref={el => { if (el) { if (page !== index) el.setAttribute('inert', ''); else el.removeAttribute('inert'); } }}
        className={`min-w-0 snap-start overflow-x-hidden overflow-y-auto ${pageClassName}`}>
        {items.slice(index * 10, index * 10 + 10)}
      </div>)}
    </div>
    {count > 1 && <div className="mt-3">
      {/* Autoplay progress. This is also the timer: the next page is shown when the bar
          finishes. A new key per page (and per touch of the list) restarts it from zero. */}
      {autoplay && <div className="h-0.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" aria-hidden="true">
        <div key={`${page}:${run}`} data-testid="auto-pages-progress"
          className="auto-pages-progress h-full origin-left bg-[var(--brand)]"
          style={{ animationPlayState: paused || tabHidden || offscreen ? 'paused' : 'running' }}
          onAnimationEnd={event => { if (event.target === event.currentTarget) go((pageRef.current + 1) % count); }} />
      </div>}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
      <span className="tabular-nums">{page * 10 + 1}–{Math.min((page + 1) * 10, items.length)} / {items.length}</span>
      <div className="flex gap-1">{Array.from({ length: count }, (_, index) => index).filter(index => count <= 7 || index === 0 || index === count - 1 || Math.abs(index - page) <= 1).map(index => <button key={index} type="button" aria-label={zh ? `第 ${index + 1} 頁` : `Page ${index + 1}`} aria-current={page === index ? 'page' : undefined} onClick={() => go(index)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"><span className={`h-1.5 rounded-full transition-[width] duration-200 motion-reduce:transition-none ${page === index ? 'w-4 bg-[var(--brand)]' : 'w-1.5 bg-slate-300 dark:bg-slate-600'}`} /></button>)}</div>
      </div>
    </div>}
  </div>;
}
