import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useEffect } from 'react';

const state = vi.hoisted(() => ({ mounts: 0 }));
vi.mock('../../contexts/AppContext', () => ({ useApp: () => ({
  language: 'en', setUser: vi.fn(), t: { loading: 'Loading', googleCompleteSignup: 'Complete sign up' },
}) }));
vi.mock('../../lib/runtimeConfig', () => ({ getRuntimeConfig: () => ({ googleClientId: 'test-client', turnstileSiteKey: 'test-sitekey' }) }));
vi.mock('../auth/Turnstile', () => ({ Turnstile: ({ onToken }: { onToken: (token: string) => void }) => {
  useEffect(() => onToken('test-only-token'), [onToken]);
  return null;
} }));
vi.mock('../auth/LocalizedGoogleLogin', () => ({ LocalizedGoogleLogin: ({ theme, containerProps }: {
  theme: string; containerProps: { style: { colorScheme: string } };
}) => {
  useEffect(() => { state.mounts++; }, []);
  return <div data-testid="google-button" data-google-theme={theme} style={containerProps.style} />;
} }));

import { AuthPanel } from './AuthPanel';
afterEach(cleanup);

it('recreates the themed Google button while keeping its transparent iframe on the Google light color scheme', async () => {
  const { rerender } = render(<AuthPanel isDark={false} />);
  await waitFor(() => expect(screen.getByTestId('google-button')).toHaveAttribute('data-google-theme', 'outline'));
  const lightMounts = state.mounts;
  rerender(<AuthPanel isDark />);
  await waitFor(() => expect(screen.getByTestId('google-button')).toHaveAttribute('data-google-theme', 'filled_black'));
  expect(screen.getByTestId('google-button')).toHaveStyle({ colorScheme: 'light' });
  expect(state.mounts).toBeGreaterThan(lightMounts);
  rerender(<AuthPanel isDark={false} />);
  await waitFor(() => expect(screen.getByTestId('google-button')).toHaveStyle({ colorScheme: 'light' }));
});
