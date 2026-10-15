import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AuthPanel } from './AuthPanel';

const mocks = vi.hoisted(() => ({ login: vi.fn(), register: vi.fn(), forgotPassword: vi.fn(), setUser: vi.fn(), config: { googleClientId: '', turnstileSiteKey: '' } }));
vi.mock('../../contexts/AppContext', () => ({ useApp: () => ({ t: { showPassword: 'Show password', hidePassword: 'Hide password' }, setUser: mocks.setUser, language: 'en' }) }));
vi.mock('../../services/authService', () => ({ authService: mocks }));
vi.mock('../../lib/runtimeConfig', () => ({ getRuntimeConfig: () => mocks.config }));
vi.mock('../auth/Turnstile', () => ({ Turnstile: () => <div>Human check</div> }));
beforeEach(() => { vi.clearAllMocks(); mocks.config.turnstileSiteKey = ''; });
afterEach(cleanup);

it('submits with Enter, prevents repeat requests, and recovers after network failure', async () => {
  const user = userEvent.setup();
  let reject!: (error: Error) => void;
  mocks.login.mockReturnValue(new Promise((_, fail) => { reject = fail; }));
  render(<AuthPanel isDark={false} />);
  await user.type(screen.getByLabelText('Email'), 'reader@example.com');
  await user.type(screen.getByLabelText('Password'), 'password123{Enter}');
  expect(mocks.login).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Signing in...' })).toBeDisabled();
  expect(screen.getByLabelText('Email')).toBeDisabled();
  reject(new Error('offline'));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Unable to connect'));
  expect(screen.getByLabelText('Email')).not.toBeDisabled();
});

it('clears password when switching modes and requires explicit Terms consent', async () => {
  const user = userEvent.setup();
  render(<AuthPanel isDark />);
  await user.type(screen.getByLabelText('Password'), 'oldpassword');
  await user.click(screen.getByRole('button', { name: 'Create one' }));
  expect(screen.getByLabelText('Password')).toHaveValue('');
  await user.type(screen.getByLabelText('Username'), 'reader');
  await user.type(screen.getByLabelText('Email'), 'reader@example.com');
  await user.type(screen.getByLabelText('Password'), 'password123{Enter}');
  expect(mocks.register).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent('Terms of Service');
  expect(screen.getAllByRole('checkbox').every(box => !(box as HTMLInputElement).checked)).toBe(true);
});

it('keeps the CAPTCHA gate for password recovery', async () => {
  mocks.config.turnstileSiteKey = 'test-site-key';
  const user = userEvent.setup();
  render(<AuthPanel isDark={false} />);
  await user.click(screen.getByRole('button', { name: 'Forgot password?' }));
  await user.type(screen.getByLabelText('Email'), 'reader@example.com{Enter}');
  expect(screen.getByRole('alert')).toHaveTextContent('Please complete the CAPTCHA');
  expect(mocks.forgotPassword).not.toHaveBeenCalled();
});
