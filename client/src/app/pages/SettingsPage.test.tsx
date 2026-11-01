import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { SettingsPage } from './SettingsPage';

const state = vi.hoisted(() => ({ user: { id: 1, username: 'reader' } as object | null, setSidebarOpen: vi.fn() }));

vi.mock('../contexts/AppContext', () => ({
  useApp: () => ({
    t: { profile: 'Profile', settings: 'Settings', deleteAccount: 'Delete account' },
    isDark: false,
    user: state.user,
    setSidebarOpen: state.setSidebarOpen,
    authInitialized: true,
  }),
}));
vi.mock('../components/profile/EditProfileForm', () => ({ EditProfileForm: () => <p>profile form</p> }));
vi.mock('../components/profile/ProfilePreferences', () => ({ ProfilePreferences: () => <p>preferences</p> }));
vi.mock('../components/profile/AccountSettings', () => ({ AccountSettings: ({ section }: { section: string }) => <p>account {section}</p> }));

function Where() {
  const location = useLocation();
  return <output>{location.pathname + location.search}</output>;
}
const at = (url: string) => render(
  <MemoryRouter initialEntries={[url]}>
    <Routes><Route path="/settings" element={<SettingsPage />} /><Route path="*" element={null} /></Routes>
    <Where />
  </MemoryRouter>,
);

afterEach(() => { cleanup(); state.user = { id: 1, username: 'reader' }; });

it('opens the section named in the URL and switches sections from the list', async () => {
  const session = userEvent.setup();
  at('/settings?section=security');
  expect(screen.getByRole('heading', { level: 2, name: 'Security' })).toBeInTheDocument();
  expect(screen.getByText('account security')).toBeInTheDocument();

  await session.click(screen.getByRole('button', { name: /Preferences and privacy/ }));
  expect(screen.getByText('preferences')).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('/settings?section=preferences');

  await session.click(screen.getByRole('button', { name: /Profile/ }));
  expect(screen.getByText('profile form')).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent(/^\/settings$/);
});

it('falls back to Profile for an unknown section', () => {
  at('/settings?section=nope');
  expect(screen.getByText('profile form')).toBeInTheDocument();
});

it('sends signed-out visitors home with the account panel open', () => {
  state.user = null;
  at('/settings');
  expect(screen.getByRole('status')).toHaveTextContent(/^\/$/);
  expect(state.setSidebarOpen).toHaveBeenCalledWith(true);
});
