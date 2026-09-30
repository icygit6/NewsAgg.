import { useUiText } from '../i18n/uiText';
import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { ArrowUp } from 'lucide-react';
import { useLocation, useNavigationType } from 'react-router';

const getMain = () => document.getElementById('main-scroll');
const positions = new Map<string, number>();

export function ScrollToTop() {
  const ui = useUiText();
  const { pathname, key } = useLocation();
  const navigation = useNavigationType();
  const previousPath = useRef('');
  const showRef = useRef(false);
  const [show, setShow] = useState(false);
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

  useEffect(() => {
    const el = getMain();
    if (!el) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const nextShow = el.scrollTop > 400;
      if (nextShow !== showRef.current) {
        showRef.current = nextShow;
        setShow(nextShow);
      }
    };
    const handleScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      el.removeEventListener('scroll', handleScroll);
    };
  }, [pathname]);

  const scrollToTop = () => getMain()?.scrollTo({
    top: 0,
    behavior: shouldReduceMotion ? 'auto' : 'smooth',
  });

  const isArticle = pathname.startsWith('/article/');
  const offset = isArticle ? 'bottom-[calc(9rem+env(safe-area-inset-bottom))] lg:bottom-24' : 'bottom-[calc(5rem+env(safe-area-inset-bottom))] lg:bottom-6';

  return (
    <AnimatePresence>
      {show && (
        <motion.button
          initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.75 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.75 }}
          whileHover={shouldReduceMotion ? undefined : { scale: 1.06 }}
          whileTap={shouldReduceMotion ? undefined : { scale: 0.94 }}
          onClick={scrollToTop}
          className={`fixed ${offset} right-6 z-50 w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-pink-500 text-white shadow-lg shadow-cyan-500/30 flex items-center justify-center hover:shadow-xl hover:shadow-cyan-500/40 transition-shadow`}
          aria-label={ui("Scroll to top")}
        >
          <ArrowUp size={20} />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
