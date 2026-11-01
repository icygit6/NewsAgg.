import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ProfilePreferences } from './ProfilePreferences';

const state = vi.hoisted(() => ({ user: {} as Record<string, unknown> }));

vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ t: { language: 'Language' }, user: state.user, setUser: vi.fn() }),
}));
vi.mock('../../services/authService', () => ({
  authService: { updatePreferences: vi.fn(), exportData: vi.fn(), setUser: vi.fn() },
}));
vi.mock('../../hooks/useInterfaceLanguage', () => ({
  useInterfaceLanguage: () => ({ choice: 'en', choose: vi.fn(), options: [{ code: 'en', short: 'EN', label: 'English' }], current: { short: 'EN', label: 'English' } }),
}));
vi.mock('../ui/TranslateNewsToggle', () => ({ TranslateNewsToggle: () => <div /> }));

beforeEach(() => localStorage.clear());
afterEach(cleanup);

const NOTICE = /verify your email first/i;

it('says what the switch actually delivers', async () => {
  state.user = { emailUpdates: false, emailVerified: true };
  render(<ProfilePreferences isDark={false} />);
  expect(await screen.findByText(/morning edition by email/i)).toBeInTheDocument();
  expect(screen.queryByText(/product and news updates/i)).not.toBeInTheDocument();
});

it('warns an opted-in but unverified account that nothing will be sent yet', async () => {
  state.user = { emailUpdates: true, emailVerified: false };
  render(<ProfilePreferences isDark={false} />);
  expect(await screen.findByText(NOTICE)).toBeInTheDocument();
});

it('does not warn a verified account, or one that has not opted in', async () => {
  for (const user of [{ emailUpdates: true, emailVerified: true }, { emailUpdates: false, emailVerified: false }]) {
    state.user = user;
    const view = render(<ProfilePreferences isDark={false} />);
    await waitFor(() => expect(screen.getByText(/morning edition by email/i)).toBeInTheDocument());
    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
    view.unmount();
  }
});
