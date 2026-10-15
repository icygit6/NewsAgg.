import { useEffect, useRef } from 'react';

// Lightweight Cloudflare Turnstile wrapper — no extra dependency, just the
// official script loaded once and rendered explicitly. Renders nothing when
// VITE_TURNSTILE_SITE_KEY is unset, so the auth forms work with zero config.
import { getRuntimeConfig } from '../../lib/runtimeConfig';
import { useApp } from '../../contexts/AppContext';
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  remove: (id: string) => void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load Turnstile'));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

interface TurnstileProps {
  /** Receives the response token to send to the server (or '' when reset/expired). */
  onToken: (token: string) => void;
  isDark?: boolean;
}

function turnstileEnabled(): boolean {
  const SITE_KEY = getRuntimeConfig().turnstileSiteKey;
  return typeof SITE_KEY === 'string' && SITE_KEY.length > 0;
}

export function Turnstile({ onToken, isDark }: TurnstileProps) {
  // The challenge text follows the interface language, like the rest of the form.
  const { language } = useApp();
  const turnstileLanguage = language === 'zhTW' ? 'zh-tw' : language === 'zhCN' ? 'zh-cn' : language === 'id' ? 'id' : 'en';
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  // Keep the latest callback without re-rendering the widget on every change.
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useEffect(() => {
    if (!turnstileEnabled()) return;
    const siteKey = getRuntimeConfig().turnstileSiteKey;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        widgetId.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: isDark ? 'dark' : 'light',
          language: turnstileLanguage,
          // Stretch to the form width instead of the fixed 300px box.
          size: 'flexible',
          callback: (token: string) => onTokenRef.current(token),
          'expired-callback': () => onTokenRef.current(''),
          'error-callback': () => onTokenRef.current(''),
        });
      })
      .catch(() => {
        /* network failure — server fails open, so don't block the form */
      });
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) {
        window.turnstile.remove(widgetId.current);
        widgetId.current = null;
      }
    };
  }, [isDark, turnstileLanguage]);

  if (!turnstileEnabled()) return null;
  return <div ref={containerRef} className="my-3 w-full" />;
}
