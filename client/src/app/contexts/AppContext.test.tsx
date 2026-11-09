import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const me = vi.hoisted(() => vi.fn());
vi.mock('../services/authService', () => ({
  authService: {
    me,
    setUser: vi.fn(),
    clearCachedUser: vi.fn(),
    updatePreferences: vi.fn(),
    updateAvatar: vi.fn(),
  },
}));
import { AppProvider, useApp } from './AppContext';

function Probe() {
  const { user, authInitialized, authUnavailable } = useApp();
  return <p data-testid="state">{`${authInitialized ? 'ready' : 'checking'}|${user?.username ?? 'none'}|${authUnavailable ? 'unavailable' : 'ok'}`}</p>;
}
const state = () => screen.getByTestId('state').textContent;
const account = { id: 7, username: 'reader', email: 'reader@example.test' };

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  window.matchMedia ??= ((query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() })) as unknown as typeof window.matchMedia;
});
afterEach(() => { cleanup(); vi.useRealTimers(); me.mockReset(); });

it('retries a failed sign-in check instead of treating the reader as signed out', async () => {
  // Rate limited once (the server answered 429), then the session is confirmed.
  me.mockResolvedValueOnce({ success: false, message: 'Too many requests' }).mockResolvedValueOnce({ success: true, user: account });
  render(<AppProvider><Probe /></AppProvider>);
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  expect(state()).toBe('checking|none|ok');
  await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
  expect(state()).toBe('ready|reader|ok');
  expect(me).toHaveBeenCalledTimes(2);
});

it('reports the check as unavailable, not signed out, when the server never answers', async () => {
  me.mockResolvedValue({ success: false, error: 'TypeError: Failed to fetch' });
  render(<AppProvider><Probe /></AppProvider>);
  await act(async () => { await vi.advanceTimersByTimeAsync(6000); });
  expect(state()).toBe('ready|none|unavailable');
  expect(me).toHaveBeenCalledTimes(3);
});

it('a real "no session" answer signs out straight away, without retrying', async () => {
  me.mockResolvedValue({ success: true, user: null });
  render(<AppProvider><Probe /></AppProvider>);
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  expect(state()).toBe('ready|none|ok');
  expect(me).toHaveBeenCalledTimes(1);
});
