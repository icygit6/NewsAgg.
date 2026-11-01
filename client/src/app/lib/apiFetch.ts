// Shared fetch wrapper for the NewsAgg API: attaches the Bearer token and
// turns a 401 on a protected route into a global sign-out signal so every
// screen reacts consistently to an expired session.

// Empty means same-origin. This works through IIS and public tunnels without
// baking a laptop-only IP address into the browser bundle.
export const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** Dispatched when a request with a token comes back 401 (token expired or
 * revoked). AppContext listens and clears the in-memory user. */
export const AUTH_UNAUTHORIZED_EVENT = 'auth:unauthorized';

/** fetch for signed-in requests: the API base, the session cookie, and the same global sign-out
 * signal as apiFetch on a 401. Returns the raw Response, so callers keep their own parsing. */
export async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${API_BASE_URL}${path}`, { ...init, credentials: 'include' });
  if (res.status === 401) window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
  return res;
}

export async function apiFetch<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };
  const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers, credentials: 'include' });

  if (res.status === 401) {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
  }
  if (!res.ok) {
    throw new ApiError(`HTTP ${res.status}: ${res.statusText}`, res.status);
  }
  return res.json() as Promise<T>;
}
