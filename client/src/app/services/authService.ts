import { AUTH_UNAUTHORIZED_EVENT } from '../lib/apiFetch';

const API_BASE = import.meta.env.VITE_API_URL || '';

export interface User {
  id: number;
  username: string;
  displayName?: string | null;
  bio?: string | null;
  email: string;
  avatar?: string | null;
  profileBackground?: number;
  profileBackgroundImage?: string | null;
  role?: string;
  emailVerified?: boolean;
  googleLinked?: boolean;
  hasPassword?: boolean;
  preferredLanguage?: 'en' | 'zhTW';
  emailUpdates?: boolean;
  termsAccepted?: boolean;
  created_at?: string;
  last_login?: string;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: User;
  error?: string;
  // Generic success/info text from the reset/verify flows.
  message?: string;
  alreadyVerified?: boolean;
  // Returned by the Google flow when the account doesn't exist yet, so the
  // signup form can be pre-filled (see AuthPanel.handleGoogleSuccess).
  needsSignup?: boolean;
  email?: string;
  username?: string;
  // Set by the server when a CAPTCHA is now required (always on register/forgot;
  // on login only after repeated failures). The form renders the widget in
  // response.
  captchaRequired?: boolean;
}

export interface AccountResponse {
  success: boolean;
  user?: User;
  avatar?: string | null;
  error?: string;
  hasPassword?: boolean;
  sessions?: AccountSession[];
  data?: unknown;
}

export interface AccountSession {
  current: boolean;
  userAgent?: string | null;
  ipAddress?: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
}

/** Authenticated fetch that, unlike apiFetch, parses the JSON body even on
 * 4xx so the server's `error` message reaches the form. Still funnels 401
 * into the global sign-out event. */
async function accountFetch(path: string, init: RequestInit = {}): Promise<AccountResponse> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    if (res.status === 401) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
    }
    return (await res.json()) as AccountResponse;
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export const authService = {
  register: async (
    email: string,
    username: string,
    password: string,
    captchaToken?: string,
    termsAccepted = false,
    emailUpdates = false,
    preferredLanguage: 'en' | 'zhTW' = 'en',
  ): Promise<AuthResponse> => {
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username, password, captchaToken, termsAccepted, emailUpdates, preferredLanguage })
      });
      return res.json();
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  login: async (email: string, password: string, captchaToken?: string): Promise<AuthResponse> => {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, captchaToken })
      });
      return res.json();
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  logout: async (): Promise<AccountResponse> => {
    try {
      const res = await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' });
      const json = (await res.json()) as AccountResponse;
      if (res.ok && json.success) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
      }
      return json;
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  // ── Password reset + email verification ───────────────────────────────────
  forgotPassword: async (email: string, captchaToken?: string): Promise<AuthResponse> => {
    try {
      const res = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, captchaToken }),
      });
      return res.json();
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  resetPassword: async (token: string, password: string): Promise<AuthResponse> => {
    try {
      const res = await fetch(`${API_BASE}/auth/reset-password`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      return res.json();
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  verifyEmail: async (token: string): Promise<AuthResponse> => {
    try {
      const res = await fetch(`${API_BASE}/auth/verify-email`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      return res.json();
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  // Bearer-protected: resends the verification email to the signed-in user.
  resendVerification: async (): Promise<AuthResponse> => {
    try {
      const res = await fetch(`${API_BASE}/auth/resend-verification`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return res.json();
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  loginWithGoogle: async (
    googleToken: string,
    captchaToken?: string,
    termsAccepted = false,
    emailUpdates = false,
    preferredLanguage: 'en' | 'zhTW' = 'en',
  ): Promise<AuthResponse> => {
    try {
      const res = await fetch(`${API_BASE}/auth/google`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: googleToken, captchaToken, termsAccepted, emailUpdates, preferredLanguage })
      });
      return res.json();
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  // ── Account management (Bearer-protected /api/account) ────────────────────
  me: (): Promise<AccountResponse> => accountFetch('/api/account/me'),

  updateProfile: (username: string): Promise<AccountResponse> =>
    accountFetch('/api/account/profile', {
      method: 'PATCH',
      body: JSON.stringify({ username }),
    }),

  // Google-only accounts add a first password through an emailed link.
  requestPasswordLink: (): Promise<AccountResponse & { message?: string }> =>
    accountFetch('/api/account/password-link', { method: 'POST' }),

  changePassword: (currentPassword: string, newPassword: string): Promise<AccountResponse> =>
    accountFetch('/api/account/password', {
      method: 'PATCH',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  updateAvatar: (avatar: string | null): Promise<AccountResponse> =>
    accountFetch('/api/account/avatar', {
      method: 'PUT',
      body: JSON.stringify({ avatar }),
    }),

  updateBackground: (background: number, image: string | null = null): Promise<AccountResponse> =>
    accountFetch('/api/account/background', {
      method: 'PUT',
      body: JSON.stringify({ background, image }),
    }),

  updatePublicProfile: (displayName: string | null, bio: string | null): Promise<AccountResponse> =>
    accountFetch('/api/account/public-profile', {
      method: 'PATCH',
      body: JSON.stringify({ displayName, bio }),
    }),

  updatePreferences: (preferences: { preferredLanguage?: 'en' | 'zhTW'; emailUpdates?: boolean }): Promise<AccountResponse> =>
    accountFetch('/api/account/preferences', {
      method: 'PATCH',
      body: JSON.stringify(preferences),
    }),

  linkGoogle: (googleToken: string): Promise<AccountResponse> =>
    accountFetch('/api/account/google', {
      method: 'POST',
      body: JSON.stringify({ token: googleToken }),
    }),

  disconnectGoogle: (currentPassword: string): Promise<AccountResponse> =>
    accountFetch('/api/account/google', { method: 'DELETE', body: JSON.stringify({ currentPassword }) }),

  deleteAccount: (confirmation: string, currentPassword: string): Promise<AccountResponse> =>
    accountFetch('/api/account', {
      method: 'DELETE',
      body: JSON.stringify({ confirmation, currentPassword }),
    }),

  sessions: (): Promise<AccountResponse> => accountFetch('/api/account/sessions'),

  exportData: (): Promise<AccountResponse> => accountFetch('/api/account/export'),

  signOutOtherSessions: (): Promise<AccountResponse> =>
    accountFetch('/api/account/sessions', { method: 'DELETE' }),

  // Compatibility shims for older callers. New browser sessions authenticate
  // with an HttpOnly cookie, so the JWT is never persisted in JavaScript.
  getToken: () => null,

  setToken: (_token: string) => localStorage.removeItem('authToken'),
  
  getUser: (): User | null => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },
  
  setUser: (user: User) => localStorage.setItem('user', JSON.stringify(user)),

  clearCachedUser: () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
  },

  isAuthenticated: () => Boolean(localStorage.getItem('user'))
};
