import { useEffect, useRef } from 'react';
import { useLocation, useNavigate, useNavigation } from 'react-router';

const PUSH_DELAY_MS = 350;

/** Gives the account drawer its own history entry, so the phone's back button closes it
 * instead of leaving the page underneath. Opening pushes an entry flagged `drawer`; closing
 * it any other way pops that entry again, so the stack never grows. */
export function useDrawerHistory(open: boolean, setOpen: (open: boolean) => void) {
  const location = useLocation();
  const navigate = useNavigate();
  const flagged = (location.state as { drawer?: boolean } | null)?.drawer === true;
  const previous = useRef({ open: false, flagged: false });
  const pending = useRef<number | undefined>(undefined);
  // The latest flag, so a delayed pop can tell the entry is already gone (back was pressed in the meantime).
  const flaggedNow = useRef(flagged);
  flaggedNow.current = flagged;
  // Whether a page is still loading, so a delayed pop never cancels the navigation a drawer link started.
  const navigation = useNavigation();
  const navigatingNow = useRef(false);
  navigatingNow.current = navigation.state !== 'idle';

  useEffect(() => {
    const before = previous.current;
    previous.current = { open, flagged };
    const { drawer: _drawer, ...rest } = (location.state as Record<string, unknown> | null) ?? {};
    const here = { pathname: location.pathname, search: location.search, hash: location.hash };

    if (open && !before.open) {
      // Pushed once the slide-in has landed: a navigation re-renders the whole route tree, which would stall the animation.
      if (!flagged) {
        window.clearTimeout(pending.current);
        pending.current = window.setTimeout(() => navigate(here, { state: { ...rest, drawer: true } }), PUSH_DELAY_MS);
      }
    } else if (!open && before.open) {
      // Closed from inside (X, scrim, swipe, a menu row): drop the entry opening it added.
      // Popped after the slide-out, for the same reason: the navigation re-renders the page mid-animation.
      // A link that closed it (and replaces the entry) may still be loading its page then; the pop would undo it.
      window.clearTimeout(pending.current);
      if (flagged) pending.current = window.setTimeout(() => { if (flaggedNow.current && !navigatingNow.current) navigate(-1); }, PUSH_DELAY_MS);
    } else if (open && before.flagged && !flagged) {
      // Back (or any move off the flagged entry) while open: that was the drawer's own step.
      setOpen(false);
    } else if (!open && flagged && !before.flagged) {
      // Landed on a stale flagged entry (forward, reload): clear the flag without adding a step.
      navigate(here, { replace: true, state: Object.keys(rest).length ? rest : null });
    }
  }, [open, flagged, location, navigate, setOpen]);
}
