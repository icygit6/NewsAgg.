import { useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router';
import { getMain, useMainScrolledPast } from '../hooks/useMainScroll';
import { ScrollTopButton } from './ui/ScrollTopButton';

const positions = new Map<string, number>();

export function ScrollToTop() {
  const { pathname, search, key, state } = useLocation();
  const navigation = useNavigationType();
  const previousPath = useRef('');
  const drawer = (state as { drawer?: boolean } | null)?.drawer === true;
  const place = useRef({ pathname, search, drawer });
  const show = useMainScrolledPast(400, pathname);

  useLayoutEffect(() => {
    const el = getMain();
    if (!el) return;
    // Opening or closing the account drawer adds or drops a history entry on the same page; keep the scroll position.
    const was = place.current;
    place.current = { pathname, search, drawer };
    if (pathname === was.pathname && search === was.search && drawer !== was.drawer) return;
    // Switching the article's Article/Insights tab only changes the query string; that page restores its own offsets.
    if (pathname.startsWith('/article/') && pathname === previousPath.current) return;
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
  }, [key, pathname, search, drawer, navigation]);

  // Phones: above the bottom tab bar. Desktop uses CentreColumnScrollTop instead.
  return (
    <ScrollTopButton
      show={show && !placesOwnScrollTop(pathname)}
      className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-6 lg:hidden"
    />
  );
}

/** Desktop: pinned to the centre column's corner (AppShell), like the article page's reading
 * column, so it sits under the content it scrolls and never covers the right rail. */
export function CentreColumnScrollTop() {
  const { pathname } = useLocation();
  const show = useMainScrolledPast(400, pathname);
  return <ScrollTopButton show={show && !placesOwnScrollTop(pathname)} className="absolute bottom-6 right-6 max-lg:hidden" />;
}

// Article pages place this control themselves (beside the reading column on desktop, in the
// chat trigger row on phones). Settings is a short form whose full-width phone buttons it would cover.
function placesOwnScrollTop(pathname: string) {
  return pathname.startsWith('/article/') || pathname === '/settings';
}
