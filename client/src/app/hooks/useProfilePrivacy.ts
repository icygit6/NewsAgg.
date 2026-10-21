import { useCallback, useSyncExternalStore } from 'react';

/** Per-device masking of the identity details on your own profile, so the
 * page stays safe to screen-share. Email and last-active are independent:
 * the toggles live in the privacy section of /profile. */
export type PrivacyKey = 'hideEmail' | 'hideLastActive';

const STORAGE_KEY: Record<PrivacyKey, string> = {
  hideEmail: 'privacy.hideEmail',
  hideLastActive: 'privacy.hideLastActive',
};

const listeners = new Set<() => void>();

const read = (key: PrivacyKey) => {
  try {
    return localStorage.getItem(STORAGE_KEY[key]) === 'true';
  } catch {
    return false;
  }
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  // Another tab flipping the same switch should land here too.
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
};

export function useProfilePrivacy(key: PrivacyKey): [boolean, (next: boolean) => void] {
  const hidden = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => false,
  );
  const set = useCallback((next: boolean) => {
    try {
      localStorage.setItem(STORAGE_KEY[key], String(next));
    } catch {
      // Private browsing: the toggle still applies for this render pass.
    }
    listeners.forEach((listener) => listener());
  }, [key]);
  return [hidden, set];
}
