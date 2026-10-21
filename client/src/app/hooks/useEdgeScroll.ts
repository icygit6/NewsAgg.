import { useCallback, useEffect, useRef, useState } from 'react';

/** Drives a horizontally scrolling strip whose scrollbar is hidden: reports
 * whether either edge is still reachable so the caller can show a nudge
 * arrow, and scrolls by a page when one is pressed. */
export function useEdgeScroll<T extends HTMLElement>(step = 240) {
  const ref = useRef<T>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return;
      // Preserve normal vertical page scrolling. A trackpad horizontal gesture
      // or Shift+wheel intentionally moves the strip.
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY) && !event.shiftKey) return;
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      if (delta === 0) return;
      el.scrollLeft += delta;
      event.preventDefault();
      update();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    // Chips arriving later (translated labels, lazy data) change the width too.
    const mutations = new MutationObserver(update);
    mutations.observe(el, { childList: true, subtree: true, characterData: true });
    update();
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('scroll', update);
      observer.disconnect();
      mutations.disconnect();
    };
  }, [update]);

  const scrollByPage = useCallback((direction: -1 | 1) => {
    ref.current?.scrollBy({ left: direction * step, behavior: 'smooth' });
  }, [step]);

  return { ref, canScrollLeft, canScrollRight, scrollByPage, update };
}
