import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowUp } from 'lucide-react';
import { useUiText } from '../../i18n/uiText';
import { scrollMainToTop } from '../../hooks/useMainScroll';

interface ScrollTopButtonProps {
  show: boolean;
  /** Placement only (fixed, absolute or in a flex row); the look is shared. */
  className?: string;
}

/** The one scroll-to-top control, so every page shows the same brand circle. */
export function ScrollTopButton({ show, className = '' }: ScrollTopButtonProps) {
  const ui = useUiText();
  const shouldReduceMotion = useReducedMotion();
  return (
    <AnimatePresence>
      {show && (
        <motion.button
          type="button"
          initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.75 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.75 }}
          whileHover={shouldReduceMotion ? undefined : { scale: 1.06 }}
          whileTap={shouldReduceMotion ? undefined : { scale: 0.94 }}
          onClick={() => scrollMainToTop(!shouldReduceMotion)}
          className={`${className} z-50 w-12 h-12 rounded-full bg-[var(--brand)] text-white shadow-lg shadow-blue-600/30 flex items-center justify-center hover:shadow-xl hover:shadow-blue-600/40 transition-shadow`}
          aria-label={ui("Scroll to top")}
          title={ui("Scroll to top")}
        >
          <ArrowUp size={20} />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
