import { useUiText } from '../i18n/uiText';
import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { ArrowUp } from 'lucide-react';
import { useLocation, useNavigationType } from 'react-router';

const getMain = () => (window.matchMedia('(min-width: 1024px)').matches
  ? document.getElementById('article-reading-scroll') : null) || document.getElementById('main-scroll');
const positions = new Map<string, number>();

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

export function ScrollToTop() {
  const ui = useUiText();
  const { pathname, key } = useLocation();
  const navigation = useNavigationType();
  const previousPath = useRef('');
  const show = useMainScrolledPast(400, pathname);
  const shouldReduceMotion = useReducedMotion();

  useLayoutEffect(() => {
    const el = getMain();
    if (!el) return;
    const restore = navigation === 'POP' && previousPath.current.startsWith('/article/')
      && !pathname.startsWith('/article/');
    const target = restore ? positions.get(key) ?? 0 : 0;
    let lastTop = target;
    previousPath.current = pathname;
    const originalRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    const move = () => el.scrollTo({ top: target, behavior: 'instant' });
    move();
    const remember = () => { lastTop = el.scrollTop; };
    el.addEventListener('scroll', remember, { passive: true });
    // Cached pages usually render immediately; support slower asynchronous layout too.
    const observer = new ResizeObserver(move);
    if (target > 0) Array.from(el.children).forEach(child => observer.observe(child));
    const stop = () => observer.disconnect();
    const timer = window.setTimeout(stop, 3000);
    el.addEventListener('wheel', stop, { passive: true });
    el.addEventListener('touchstart', stop, { passive: true });
    el.addEventListener('keydown', stop);
    return () => {
      positions.set(key, lastTop);
      if (positions.size > 100) positions.delete(positions.keys().next().value!);
      observer.disconnect();
      window.clearTimeout(timer);
      el.removeEventListener('wheel', stop);
      el.removeEventListener('touchstart', stop);
      el.removeEventListener('keydown', stop);
      el.removeEventListener('scroll', remember);
      window.history.scrollRestoration = originalRestoration;
    };
  }, [key, pathname, navigation]);

  const scrollToTop = () => scrollMainToTop(!shouldReduceMotion);

  // Article pages place this control beside the chat trigger (ArticleChat),
  // so two stacked floating buttons no longer cover the reading column.
  const isArticle = pathname.startsWith('/article/');
  const offset = 'bottom-[calc(5rem+env(safe-area-inset-bottom))] lg:bottom-6';

  return (
    <AnimatePresence>
      {show && !isArticle && (
        <motion.button
          initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.75 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.75 }}
          whileHover={shouldReduceMotion ? undefined : { scale: 1.06 }}
          whileTap={shouldReduceMotion ? undefined : { scale: 0.94 }}
          onClick={scrollToTop}
          className={`fixed ${offset} right-6 z-50 w-12 h-12 rounded-full bg-[var(--brand)] text-white shadow-lg shadow-blue-600/30 flex items-center justify-center hover:shadow-xl hover:shadow-blue-600/40 transition-shadow`}
          aria-label={ui("Scroll to top")}
        >
          <ArrowUp size={20} />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
