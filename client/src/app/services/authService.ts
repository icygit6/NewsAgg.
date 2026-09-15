import { AUTH_UNAUTHORIZED_EVENT } from '../lib/apiFetch';

const API_BASE = import.meta.env.VITE_API_URL || '';

export interface User {
  id: number;
  username: string;
  email: string;
  avatar?: string | null;
  role?: string;
  emailVerified?: boolean;
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
}

/** Authenticated fetch that, unlike apiFetch, parses the JSON body even on
 * 4xx so the server's `error` message reaches the form. Still funnels 401
 * into the global sign-out event. */
async function accountFetch(path: string, init: RequestInit = {}): Promise<AccountResponse> {
  try {
    const token = localStorage.getItem('authToken');
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (res.status === 401 && token) {
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
  ): Promise<AuthResponse> => {
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username, password, captchaToken })
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, captchaToken })
      });
      return res.json();
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  logout: () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
  },

  // ── Password reset + email verification ───────────────────────────────────
  forgotPassword: async (email: string, captchaToken?: string): Promise<AuthResponse> => {
    try {
      const res = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: 'POST',
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
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${API_BASE}/auth/resend-verification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      return res.json();
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  loginWithGoogle: async (googleToken: string): Promise<AuthResponse> => {
    try {
      const res = await fetch(`${API_BASE}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: googleToken })
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

  changePassword: (currentPassword: string, newPassword: string): Promise<AccountResponse> =>
    accountFetch('/api/account/password', {
      method: 'PATCH',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  updateAvatar: (avatar: string): Promise<AccountResponse> =>
    accountFetch('/api/account/avatar', {
      method: 'PUT',
      body: JSON.stringify({ avatar }),
    }),

  deleteAccount: (): Promise<AccountResponse> =>
    accountFetch('/api/account', { method: 'DELETE' }),

  getToken: () => localStorage.getItem('authToken'),

  setToken: (token: string) => localStorage.setItem('authToken', token),
  
  getUser: (): User | null => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },
  
  setUser: (user: User) => localStorage.setItem('user', JSON.stringify(user)),

  isAuthenticated: () => !!localStorage.getItem('authToken')
};
