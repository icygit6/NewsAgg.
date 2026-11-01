import { useEffect, useRef, useState } from 'react';

/** The element that scrolls the page: the article reading column on desktop
 * article pages, otherwise the shell's main scroll area. */
export const getMain = () => (window.matchMedia('(min-width: 1024px)').matches
  ? document.getElementById('article-reading-scroll') : null) || document.getElementById('main-scroll');

/** True once the main scroll area has moved past `threshold` pixels. */
export function useMainScrolledPast(threshold = 400, resetKey?: string) {
  const showRef = useRef(false);
  const [show, setShow] = useState(false);
  useEffect(() => {
    const el = getMain();
    if (!el) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const nextShow = (getMain()?.scrollTop ?? 0) > threshold;
      if (nextShow !== showRef.current) {
        showRef.current = nextShow;
        setShow(nextShow);
      }
    };
    const handleScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    document.addEventListener('scroll', handleScroll, { passive: true, capture: true });
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      document.removeEventListener('scroll', handleScroll, true);
    };
  }, [threshold, resetKey]);
  return show;
}

export const scrollMainToTop = (smooth: boolean) => getMain()?.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
