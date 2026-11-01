import { useCallback, useEffect, useRef, useState } from 'react';

const scrollBehavior = (): ScrollBehavior => window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';

/** Drives a horizontally scrolling strip whose scrollbar is hidden: reports
 * whether either edge is still reachable so the caller can show a nudge
 * arrow, and scrolls by a page when one is pressed. */
export function useEdgeScroll<T extends HTMLElement>(step = 240) {
  const ref = useRef<T>(null);
  const cancelWheelRef = useRef<(() => void) | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  // Move only this strip, avoiding scrollIntoView's movement of page ancestors.
  const revealItem = useCallback((item: HTMLElement, center = false) => {
    const el = ref.current;
    if (!el) return;
    cancelWheelRef.current?.();
    const bounds = el.getBoundingClientRect();
    const itemBounds = item.getBoundingClientRect();
    if (itemBounds.left >= bounds.left + 4 && itemBounds.right <= bounds.right - 4) return;
    const delta = center
      ? itemBounds.left + itemBounds.width / 2 - bounds.left - bounds.width / 2
      : itemBounds.left < bounds.left + 4 ? itemBounds.left - bounds.left - 4 : itemBounds.right - bounds.right + 4;
    el.scrollBy({ left: delta, behavior: scrollBehavior() });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    let wheelFrame = 0;
    let wheelTarget = el.scrollLeft;
    let previousTime = 0;
    const stopWheel = () => {
      cancelAnimationFrame(wheelFrame);
      wheelFrame = 0;
      wheelTarget = el.scrollLeft;
    };
    cancelWheelRef.current = stopWheel;
    const animateWheel = (time: number) => {
      const current = el.scrollLeft;
      const remaining = wheelTarget - current;
      if (Math.abs(remaining) <= 1) {
        el.scrollTo({ left: wheelTarget, behavior: 'instant' });
        wheelFrame = 0;
        return;
      }
      // Frame-rate-independent easing towards an accumulated destination.
      // Scroll position stays outside React; only edge visibility uses state.
      const elapsed = Math.max(1, Math.min(64, time - previousTime));
      previousTime = time;
      const eased = Math.abs(remaining) * (1 - Math.exp(-elapsed / 65));
      // Keep settling even in browsers that round scroll offsets to whole pixels.
      const travel = Math.sign(remaining) * Math.min(Math.abs(remaining), Math.max(1, eased));
      el.scrollTo({ left: current + travel, behavior: 'instant' });
      wheelFrame = requestAnimationFrame(animateWheel);
    };
    const scheduleUpdate = () => {
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; update(); });
    };
    const onWheel = (event: WheelEvent) => {
      if (event.defaultPrevented) return;
      if (event.ctrlKey) { stopWheel(); return; }
      const maxScroll = el.scrollWidth - el.clientWidth;
      if (maxScroll <= 0) return;
      // Native horizontal trackpad/Shift-wheel gestures retain browser momentum.
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) { stopWheel(); return; }
      const unit = event.deltaMode === 1 ? parseFloat(getComputedStyle(el).lineHeight) || 16
        : event.deltaMode === 2 ? el.clientWidth : 1;
      const delta = event.deltaY * unit;
      if (delta === 0) return;
      if (!wheelFrame || delta * (wheelTarget - el.scrollLeft) < 0) wheelTarget = el.scrollLeft;
      const next = Math.max(0, Math.min(maxScroll, wheelTarget + delta));
      if (Math.abs(next - el.scrollLeft) < 0.5 && !wheelFrame) return;
      event.preventDefault();
      wheelTarget = next;
      if (scrollBehavior() === 'instant') {
        stopWheel();
        el.scrollTo({ left: next, behavior: 'instant' });
      } else if (!wheelFrame) {
        previousTime = performance.now();
        wheelFrame = requestAnimationFrame(animateWheel);
      }
    };
    const onFocus = (event: FocusEvent) => {
      if (event.target instanceof HTMLElement) revealItem(event.target);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const buttons = Array.from(el.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
      const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
      if (current < 0) return;
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
        : event.key === 'ArrowRight' ? Math.min(current + 1, buttons.length - 1)
        : event.key === 'ArrowLeft' ? Math.max(0, current - 1) : -1;
      if (next < 0) return;
      event.preventDefault();
      stopWheel();
      buttons[next]?.focus({ preventScroll: true });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('scroll', scheduleUpdate, { passive: true });
    el.addEventListener('focusin', onFocus);
    el.addEventListener('keydown', onKey);
    el.addEventListener('pointerdown', stopWheel, { passive: true });
    el.addEventListener('touchstart', stopWheel, { passive: true });
    const onResize = () => {
      wheelTarget = Math.max(0, Math.min(el.scrollWidth - el.clientWidth, wheelTarget));
      scheduleUpdate();
    };
    const observer = new ResizeObserver(onResize);
    observer.observe(el);
    Array.from(el.children).forEach(child => observer.observe(child));
    // Chips arriving later (translated labels, lazy data) change the width too.
    const mutations = new MutationObserver(() => {
      Array.from(el.children).forEach(child => observer.observe(child));
      scheduleUpdate();
    });
    mutations.observe(el, { childList: true, subtree: true, characterData: true });
    update();
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('scroll', scheduleUpdate);
      el.removeEventListener('focusin', onFocus);
      el.removeEventListener('keydown', onKey);
      el.removeEventListener('pointerdown', stopWheel);
      el.removeEventListener('touchstart', stopWheel);
      stopWheel();
      cancelWheelRef.current = null;
      cancelAnimationFrame(frame);
      observer.disconnect();
      mutations.disconnect();
    };
  }, [update, revealItem]);

  const scrollByPage = useCallback((direction: -1 | 1) => {
    const el = ref.current;
    if (el) {
      cancelWheelRef.current?.();
      el.scrollBy({ left: direction * Math.max(step, el.clientWidth * 0.8), behavior: scrollBehavior() });
    }
  }, [step]);

  return { ref, canScrollLeft, canScrollRight, scrollByPage, revealItem, update };
}
