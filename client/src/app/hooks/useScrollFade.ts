import { useCallback, useEffect, useRef, useState } from 'react';

/** For a vertically scrolling list whose scrollbar is hidden: reports whether
 * more content sits above or below the viewport, so the caller can fade that
 * edge and the reader can tell the list continues. Horizontal strips use
 * useEdgeScroll instead. */
export function useScrollFade<T extends HTMLElement>(targetKey?: unknown) {
  const ref = useRef<T>(null);
  const [edges, setEdges] = useState({ above: false, below: false });

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const above = el.scrollTop > 2;
    const below = el.scrollTop + el.clientHeight < el.scrollHeight - 2;
    setEdges((previous) => (previous.above === above && previous.below === below ? previous : { above, below }));
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.addEventListener('scroll', update, { passive: true });
    el.addEventListener('load', update, true);
    const resize = new ResizeObserver(update);
    resize.observe(el);
    // Rows arriving later (translated titles, a refetch) change the height too.
    const mutations = new MutationObserver(update);
    mutations.observe(el, { childList: true, subtree: true, characterData: true });
    update();
    return () => {
      el.removeEventListener('scroll', update);
      el.removeEventListener('load', update, true);
      resize.disconnect();
      mutations.disconnect();
    };
  }, [update, targetKey]);

  return { ref, ...edges };
}

/** CSS mask that fades whichever edges still have content beyond them. */
export function fadeMask(above: boolean, below: boolean, size = 28): { maskImage?: string; WebkitMaskImage?: string } {
  if (!above && !below) return {};
  const gradient = `linear-gradient(to bottom, ${above ? `transparent 0, black ${size}px` : 'black 0'}, ${below ? `black calc(100% - ${size}px), transparent 100%` : 'black 100%'})`;
  return { maskImage: gradient, WebkitMaskImage: gradient };
}
