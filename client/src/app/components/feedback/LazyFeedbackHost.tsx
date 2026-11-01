import { lazy, Suspense, useEffect, useState } from 'react';
import { OPEN_FEEDBACK_EVENT } from '../../hooks/useFeedback';

// The dialog (Radix, Vaul and the form) is only downloaded the first time someone opens it,
// so it costs nothing on the first page load.
const FeedbackDialog = lazy(() => import('./FeedbackDialog').then((m) => ({ default: m.FeedbackDialog })));

export function LazyFeedbackHost() {
  const [open, setOpen] = useState(false);
  const [wanted, setWanted] = useState(false);
  useEffect(() => {
    const show = () => { setWanted(true); setOpen(true); };
    window.addEventListener(OPEN_FEEDBACK_EVENT, show);
    return () => window.removeEventListener(OPEN_FEEDBACK_EVENT, show);
  }, []);
  if (!wanted) return null;
  return <Suspense fallback={null}><FeedbackDialog open={open} onOpenChange={setOpen} /></Suspense>;
}
