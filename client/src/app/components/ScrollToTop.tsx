import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowUp } from 'lucide-react';
import { useLocation } from 'react-router';

const getMain = () => document.getElementById('main-scroll');

export function ScrollToTop() {
  const { pathname } = useLocation();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!pathname.startsWith('/article/')) return;
    getMain()?.scrollTo({ top: 0, behavior: 'auto' });
  }, [pathname]);

  useEffect(() => {
    const el = getMain();
    if (!el) return;
    const handleScroll = () => setShow(el.scrollTop > 400);
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [pathname]);

  const scrollToTop = () => getMain()?.scrollTo({ top: 0, behavior: 'smooth' });

  const isArticle = pathname.startsWith('/article/');
  const offset = isArticle ? 'bottom-36 md:bottom-24' : 'bottom-20 md:bottom-6';

  return (
    <AnimatePresence>
      {show && (
        <motion.button
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.5 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={scrollToTop}
          className={`fixed ${offset} right-6 z-50 w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-pink-500 text-white shadow-lg shadow-cyan-500/30 flex items-center justify-center hover:shadow-xl hover:shadow-cyan-500/40 transition-shadow`}
          aria-label="Scroll to top"
        >
          <ArrowUp size={20} />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
