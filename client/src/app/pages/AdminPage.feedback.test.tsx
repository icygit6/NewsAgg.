import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { AdminFeedback } from '../hooks/useAdmin';

const mutate = vi.fn();
const overview = { data: { users: 5, posts: 3, articles: 900, open_article_reports: 1, open_post_reports: 0, open_feedback: 2, database_bytes: 50_000_000, tables: [] } };
const items: AdminFeedback[] = [
  { id: 12, kind: 'bug', message: 'The filter panel will not close on my phone.', page: '/posts', contact_email: 'reader@example.com', user_agent: 'Mozilla/5.0 (iPhone)', status: 'open', created_at: '2026-10-21T12:00:00Z', username: null, account_email: null },
  { id: 11, kind: 'suggestion', message: 'A weekly digest would be nice.', page: '/', contact_email: null, user_agent: null, status: 'reviewed', created_at: '2026-10-20T12:00:00Z', username: 'reader', account_email: 'reader@mail.example' },
];
const feedback = { data: items, isLoading: false, isError: false };

vi.mock('../contexts/AppContext', () => ({ useApp: () => ({ user: { id: 1, role: 'admin' }, isDark: false, setSidebarOpen: vi.fn() }) }));
vi.mock('../hooks/useAdmin', async (original) => ({
  ...(await original<typeof import('../hooks/useAdmin')>()),
  useIsAdmin: () => true,
  useAdminPermissions: () => ({ data: { canManageRoles: false } }),
  useDeletedContent: () => ({ data: [] }),
  useAdminOverview: () => overview,
  useAdminReports: () => ({ data: undefined }),
  useAdminUsers: () => ({ data: undefined }),
  useAdminFeedback: () => feedback,
  useAdminActions: () => ({ articleReport: { isPending: false }, postReport: { isPending: false }, deleteUser: { isPending: false }, feedback: { isPending: false, mutate } }),
}));

import { AdminPage } from './AdminPage';
import { adminAttentionCount } from '../hooks/useAdmin';

beforeEach(() => mutate.mockReset());
afterEach(cleanup);

const renderPage = () => render(<MemoryRouter><AdminPage /></MemoryRouter>);

it('has a Feedback tab badged with the number of new items', () => {
  renderPage();
  expect(screen.getByRole('tab', { name: /Feedback\s*2/ })).toBeInTheDocument();
  expect(screen.getByText('New feedback').nextSibling).toHaveTextContent('2');
});

it('lists each message with its kind, sender, page and device', () => {
  renderPage();
  fireEvent.click(screen.getByRole('tab', { name: /Feedback/ }));
  expect(screen.getByText('The filter panel will not close on my phone.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'reader@example.com' })).toHaveAttribute('href', 'mailto:reader@example.com');
  expect(screen.getByRole('link', { name: '@reader' })).toHaveAttribute('href', '/profile/reader');
  expect(screen.getByRole('link', { name: '/posts' })).toHaveAttribute('href', '/posts');
  expect(screen.getByText(/Mozilla\/5\.0 \(iPhone\)/)).toBeInTheDocument();
  expect(screen.getByText('Reviewed')).toBeInTheDocument();
});

it('moves an item to reviewed, resolved or back to open', () => {
  renderPage();
  fireEvent.click(screen.getByRole('tab', { name: /Feedback/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Mark reviewed' }));
  expect(mutate).toHaveBeenLastCalledWith({ id: 12, status: 'reviewed' }, expect.anything());
  fireEvent.click(screen.getAllByRole('button', { name: 'Reopen' })[0]);
  expect(mutate).toHaveBeenLastCalledWith({ id: 11, status: 'open' }, expect.anything());
  expect(screen.getAllByRole('button', { name: 'Mark resolved' })).toHaveLength(2);
});

it('counts new feedback in the admin badge alongside open reports', () => {
  expect(adminAttentionCount(overview.data)).toBe(3);
  expect(adminAttentionCount(undefined)).toBe(0);
});
