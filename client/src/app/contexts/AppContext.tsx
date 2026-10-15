import { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';
import { Language, translations, Translations } from '../i18n/translations';
import { Category } from '../constants';
import { User, authService } from '../services/authService';
import { AUTH_UNAUTHORIZED_EVENT } from '../lib/apiFetch';
import type { SentimentType } from '../types/sentiment';
import type { ArticleSort } from '../services/newsAPI';
import { UiLocaleContext } from '../i18n/uiText';

// UI + identity state only. Server state (articles, bookmarks, quotes,
// preferences) lives in React Query hooks — see hooks/.
interface AppContextType {
  // Theme
  isDark: boolean;
  toggleTheme: () => void;
  // Language
  language: Language;
  setLanguage: (lang: Language) => void;
  // How news text is shown. 'original' (the default) keeps every story in the
  // language it was published in; 'translated' follows the interface language.
  newsMode: NewsMode;
  setNewsMode: (mode: NewsMode) => void;
  t: Translations;
  // Sidebar
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  // Category filter
  selectedCategory: Category | 'all';
  setSelectedCategory: (cat: Category | 'all') => void;
  // Source filter (e.g. ['cnn', 'bbc', 'aljazeera', 'yahoo_tw'])
  selectedSources: string[];
  setSelectedSources: (s: string[]) => void;
  // Sentiment filter (positive | neutral | negative | 'all')
  selectedSentiment: SentimentType | 'all';
  setSelectedSentiment: (s: SentimentType | 'all') => void;
  // Feed ordering
  selectedSort: ArticleSort;
  setSelectedSort: (sort: ArticleSort) => void;
  // Search
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  // Auth
  user: User | null;
  isAuthenticated: boolean;
  authInitialized: boolean;
  setUser: (user: User | null) => void;
  // Avatar (user-set profile picture, persisted per-account in localStorage)
  avatarUrl: string | null;
  setAvatarUrl: (url: string | null) => void;
  avatarSrc: string; // effective src: custom avatar, else generated fallback
}

export type NewsMode = 'original' | 'translated';

const GUEST_AVATAR = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="#e2e8f0"/>' +
  '<circle cx="20" cy="15" r="7" fill="#94a3b8"/><path d="M6 37c1.5-8 7-12 14-12s12.5 4 14 12" fill="#94a3b8"/></svg>',
)}`;

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(() => localStorage.getItem('isDark') === 'true');
  const [language, setLanguageState] = useState<Language>(() =>
    localStorage.getItem('language') === 'zhTW' ? 'zhTW' : 'en',
  );
  const [newsMode, setNewsMode] = useState<NewsMode>(() =>
    localStorage.getItem('newsMode') === 'translated' ? 'translated' : 'original',
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | 'all'>('all');
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [selectedSentiment, setSelectedSentiment] = useState<SentimentType | 'all'>('all');
  const [selectedSort, setSelectedSort] = useState<ArticleSort>('latest');
  const [searchQuery, setSearchQuery] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [avatarUrl, setAvatarUrlState] = useState<string | null>(null);

  const setLanguage = useCallback((lang: Language) => {
    // The public product currently guarantees complete UI + news translation
    // for these two locales. Keep legacy values from leaking into the account.
    const supported: Language = lang === 'zhTW' ? 'zhTW' : 'en';
    setLanguageState(supported);
    if (user) {
      void authService.updatePreferences({ preferredLanguage: supported }).then((res) => {
        if (res.success && res.user) {
          setUser(res.user);
          authService.setUser(res.user);
        }
      });
    }
  }, [user]);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('isDark', String(isDark));
  }, [isDark]);

  // Persist the selected language so it survives reloads
  useEffect(() => {
    localStorage.setItem('language', language);
    document.documentElement.lang = language === 'zhTW' ? 'zh-Hant' : 'en';
    // Retire the former global content-translation preference.
    localStorage.removeItem('translateMode');
  }, [language]);

  useEffect(() => {
    localStorage.setItem('newsMode', newsMode);
  }, [newsMode]);

  // A signed-in account's saved locale follows it to every browser/device.
  useEffect(() => {
    if (user?.preferredLanguage === 'en' || user?.preferredLanguage === 'zhTW') {
      setLanguageState(user.preferredLanguage);
    }
  }, [user?.preferredLanguage]);


  // Paint the last known non-sensitive profile immediately, then validate the
  // HttpOnly cookie against /api/account/me. The JWT itself is never readable
  // by browser JavaScript.
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (err) {
        console.error('Error loading user from localStorage:', err);
      }
    }
    authService
      .me()
      .then((res) => {
        if (res.success && res.user) {
          setUser(res.user);
          authService.setUser(res.user);
        } else if (res.success && res.user === null) {
          // No session cookie: drop any profile cached by an earlier sign-in.
          setUser(null);
          authService.clearCachedUser();
        }
      })
      // accountFetch resolves {success:false} on its own failures; this catch
      // is defense-in-depth so boot-time validation can never reject unhandled.
      .catch(() => {})
      .finally(() => setAuthInitialized(true));
  }, []);

  // Verification links commonly open in a new tab. Refresh an account that
  // still looks unverified whenever this tab becomes active again, so the
  // verification banner disappears without requiring a sign-out or reload.
  useEffect(() => {
    if (!user || user.emailVerified !== false) return;

    let refreshing = false;
    const refreshVerificationState = async () => {
      if (refreshing || document.visibilityState === 'hidden') return;
      refreshing = true;
      try {
        const res = await authService.me();
        if (res.success && res.user) {
          setUser(res.user);
          authService.setUser(res.user);
        }
      } finally {
        refreshing = false;
      }
    };

    const onVisibilityChange = () => void refreshVerificationState();
    window.addEventListener('focus', onVisibilityChange);
    document.addEventListener('visibilitychange', onVisibilityChange);
    void refreshVerificationState();
    return () => {
      window.removeEventListener('focus', onVisibilityChange);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
    // Depend on identity + verification only; depending on the whole profile
    // would refetch whenever an unrelated field receives a new object value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email, user?.emailVerified]);

  // One-time migration: avatars used to live only in this browser's
  // localStorage; push the local copy to the server once, then drop it.
  useEffect(() => {
    if (!user) return;
    const key = `avatar:${user.email}`;
    const local = localStorage.getItem(key);
    if (!local || user.avatar) {
      if (local && user.avatar) localStorage.removeItem(key);
      return;
    }
    authService.updateAvatar(local).then((res) => {
      if (res.success) {
        localStorage.removeItem(key);
        setUser((prev) => (prev ? { ...prev, avatar: res.avatar ?? local } : prev));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email]);

  // Expired/revoked token detected by apiFetch -> drop the in-memory user.
  useEffect(() => {
    const onUnauthorized = () => setUser(null);
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  // Load the saved avatar for whichever account is signed in (keyed by email so
  // switching accounts on the same browser doesn't leak avatars between them).
  useEffect(() => {
    setAvatarUrlState(user ? localStorage.getItem(`avatar:${user.email}`) : null);
  }, [user]);

  const setAvatarUrl = (url: string | null) => {
    setAvatarUrlState(url);
    if (!user) return;
    const key = `avatar:${user.email}`;
    if (url) localStorage.setItem(key, url);
    else localStorage.removeItem(key);
  };

  const toggleTheme = () => setIsDark((prev) => !prev);
  const t = translations[language];
  const isAuthenticated = !!user;
  // Server-stored avatar wins; the localStorage copy only bridges the
  // one-time migration; dicebear is the generated fallback.
  // Signed-out visitors get a neutral silhouette rather than a generated
  // person, which read as somebody else's account.
  const avatarSrc = user
    ? user.avatar ||
      avatarUrl ||
      `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.username || 'NewsAgg2026')}`
    : GUEST_AVATAR;

  const value = useMemo<AppContextType>(
    () => ({
      isDark,
      toggleTheme,
      language,
      setLanguage,
      newsMode,
      setNewsMode,
      t,
      sidebarOpen,
      setSidebarOpen,
      selectedCategory,
      setSelectedCategory,
      selectedSources,
      setSelectedSources,
      selectedSentiment,
      setSelectedSentiment,
      selectedSort,
      setSelectedSort,
      searchQuery,
      setSearchQuery,
      user,
      isAuthenticated,
      authInitialized,
      setUser,
      avatarUrl,
      setAvatarUrl,
      avatarSrc,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      isDark,
      language,
      newsMode,
      t,
      sidebarOpen,
      selectedCategory,
      selectedSources,
      selectedSentiment,
      selectedSort,
      searchQuery,
      user,
      isAuthenticated,
      authInitialized,
      avatarUrl,
      avatarSrc,
    ],
  );

  return <AppContext.Provider value={value}><UiLocaleContext.Provider value={language}>{children}</UiLocaleContext.Provider></AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
