import { createBrowserRouter, redirect } from 'react-router';
import { Root } from './pages/Root';
import { RouteFallback } from './components/RouteFallback';
import { RouteError } from './components/RouteError';

// Every page is a router-native lazy route, so the initial bundle ships only
// the shell; each page's chunk loads on first navigation. Because the first
// matched route is always lazy, a HydrateFallback is required on each top-level
// route, or React Router warns and paints blank during initial hydration.
export const router = createBrowserRouter([
  {
    path: '/',
    Component: Root,
    ErrorBoundary: RouteError,
    HydrateFallback: RouteFallback,
    children: [
      {
        index: true,
        // Infinite feed — a bottom-of-page footer is unreachable here; the
        // sticky right rail's FooterCompact serves as the footer instead.
        handle: { hideFooter: true },
        lazy: async () => ({ Component: (await import('./pages/Home')).Home }),
      },
      // Top headlines now live in the Home HeroCarousel; keep stale URLs working.
      { path: 'top-headlines', loader: () => redirect('/') },
      {
        path: 'bookmarks',
        handle: { mobileFooter: true, title: ['Bookmarks', '書籤'] },
        lazy: async () => ({ Component: (await import('./pages/BookmarksPage')).BookmarksPage }),
      },
      {
        path: 'insights',
        handle: { hideRightRail: true, mobileFooter: true, title: ['Insights', '洞察'] },
        lazy: async () => ({ Component: (await import('./pages/InsightsPage')).InsightsPage }),
      },
      {
        path: 'profile',
        handle: { hideRightRail: true, mobileFooter: true, title: ['Profile', '個人資料'] },
        lazy: async () => ({ Component: (await import('./pages/ProfilePage')).ProfilePage }),
      },
      {
        path: 'settings',
        handle: { hideRightRail: true, mobileFooter: true, title: ['Settings', '設定'] },
        lazy: async () => ({ Component: (await import('./pages/SettingsPage')).SettingsPage }),
      },
      {
        path: 'posts',
        handle: { mobileFooter: true, title: ['Posts', '貼文'] },
        lazy: async () => ({ Component: (await import('./pages/PostsPage')).PostsPage }),
      },
      {
        path: 'country/:iso',
        handle: { mobileFooter: true, title: ['News by country', '各國新聞'] },
        lazy: async () => ({ Component: (await import('./pages/CountryPage')).CountryPage }),
      },
      {
        path: 'article/:id',
        handle: { hideRightRail: true, mobileFooter: true },
        lazy: async () => ({ Component: (await import('./pages/ArticlePage')).ArticlePage }),
      },
      {
        path: 'profile/:username',
        handle: { hideRightRail: true, mobileFooter: true, title: ['Profile', '個人資料'] },
        lazy: async () => ({ Component: (await import('./pages/PublicProfilePage')).PublicProfilePage }),
      },
      {
        path: 'admin',
        handle: { hideRightRail: true, mobileFooter: true, title: ['Admin', '管理'] },
        lazy: async () => ({ Component: (await import('./pages/AdminPage')).AdminPage }),
      },
      // Sources live in the Insights "Collection sources" tab; keep the old URL working.
      { path: 'sources', loader: () => redirect('/insights?view=sources') },
      {
        path: 'methodology',
        handle: { hideRightRail: true, mobileFooter: true, title: ['How NewsAgg works', 'NewsAgg 如何運作'] },
        lazy: async () => ({ Component: (await import('./pages/MethodologyPage')).MethodologyPage }),
      },
      {
        path: 'terms',
        handle: { hideRightRail: true, mobileFooter: true, title: ['Terms of Service', '服務條款'] },
        lazy: async () => ({ Component: (await import('./pages/LegalPages')).TermsPage }),
      },
      {
        path: 'editorial-policy',
        handle: { hideRightRail: true, mobileFooter: true, title: ['Editorial & corrections policy', '編輯與更正政策'] },
        lazy: async () => ({ Component: (await import('./pages/LegalPages')).EditorialPolicyPage }),
      },
      {
        path: 'privacy',
        handle: { hideRightRail: true, mobileFooter: true, title: ['Privacy Policy', '隱私政策'] },
        lazy: async () => ({ Component: (await import('./pages/LegalPages')).PrivacyPage }),
      },
      { path: '*', handle: { title: ['Page not found', '找不到頁面'] }, lazy: async () => ({ Component: (await import('./pages/NotFound')).NotFound }) },
    ],
  },
  // Standalone auth flows — rendered outside the app shell (no nav/feed).
  // Reachable directly from email links, so they carry their own fallback.
  {
    path: '/reset-password',
    ErrorBoundary: RouteError,
    HydrateFallback: RouteFallback,
    lazy: async () => ({ Component: (await import('./pages/ResetPasswordPage')).ResetPasswordPage }),
  },
  {
    path: '/verify-email',
    ErrorBoundary: RouteError,
    HydrateFallback: RouteFallback,
    lazy: async () => ({ Component: (await import('./pages/VerifyEmailPage')).VerifyEmailPage }),
  },
]);
