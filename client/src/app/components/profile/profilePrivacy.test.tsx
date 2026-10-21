import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ProfileHeader } from './ProfileHeader';
import { ProfilePreferences } from './ProfilePreferences';

const user = {
  id: 1,
  username: 'reader',
  email: 'reader@example.com',
  created_at: '2026-01-02T00:00:00.000Z',
  last_login: '2026-10-19T00:00:00.000Z',
  emailUpdates: false,
};

vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({
    t: { memberSince: 'Member since', lastActive: 'Last active', language: 'Language' },
    user,
    setUser: vi.fn(),
  }),
}));
vi.mock('../../services/authService', () => ({
  authService: { updateBackground: vi.fn(), updatePreferences: vi.fn(), exportData: vi.fn() },
}));
vi.mock('../../services/mem0Service', () => ({
  mem0Service: {
    getUserPreferences: () => Promise.resolve({ enabled: true, topics: [] }),
    setPersonalization: vi.fn(),
    clearReadingHistory: vi.fn(),
  },
}));
vi.mock('./AvatarEditor', () => ({ AvatarEditor: () => <div /> }));
vi.mock('../ui/LanguageSwitcher', () => ({
  useInterfaceLanguage: () => ({ choice: 'en', choose: vi.fn(), options: [{ code: 'en', short: 'EN', label: 'English' }], current: { short: 'EN', label: 'English' } }),
}));
vi.mock('../ui/TranslateNewsToggle', () => ({ TranslateNewsToggle: () => <div /> }));

const page = () => <>
  <ProfileHeader isDark={false} />
  <ProfilePreferences isDark={false} />
</>;

beforeEach(() => localStorage.clear());
afterEach(cleanup);

it('masks the email and the last active date from the privacy section, independently', async () => {
  const session = userEvent.setup();
  render(page());
  await waitFor(() => expect(screen.getByText('reader@example.com')).toBeInTheDocument());
  // The rendered date is locale-dependent; what matters is that it is not dotted out.
  expect(screen.getByText(/Last active/)).not.toHaveTextContent('••••');

  await session.click(screen.getByRole('switch', { name: /Hide my email address/ }));
  expect(screen.queryByText('reader@example.com')).not.toBeInTheDocument();
  expect(screen.getByText('re••••@example.com')).toBeInTheDocument();
  // The date is a separate switch, so it stays visible.
  expect(screen.getByText(/Last active/)).not.toHaveTextContent('••••');

  await session.click(screen.getByRole('switch', { name: /Hide my last active date/ }));
  expect(screen.getByText(/Last active/)).toHaveTextContent('••••');
  expect(screen.getByText('re••••@example.com')).toBeInTheDocument();

  await session.click(screen.getByRole('switch', { name: /Hide my email address/ }));
  expect(screen.getByText('reader@example.com')).toBeInTheDocument();
  expect(screen.getByText(/Last active/)).toHaveTextContent('••••');
});

it('remembers each choice across a remount', async () => {
  const session = userEvent.setup();
  const first = render(page());
  await session.click(await screen.findByRole('switch', { name: /Hide my last active date/ }));
  first.unmount();

  render(page());
  await waitFor(() => expect(screen.getByText(/Last active/)).toHaveTextContent('••••'));
  expect(screen.getByText('reader@example.com')).toBeInTheDocument();
});
