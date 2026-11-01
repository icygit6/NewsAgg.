import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const app = vi.hoisted(() => ({ user: null as null | { id: number; username: string } }));
vi.mock('../../contexts/AppContext', () => ({ useApp: () => ({ isDark: false, user: app.user }) }));

import { FeedbackHost } from './FeedbackDialog';
import { openFeedback } from '../../hooks/useFeedback';

const toastSuccess = vi.hoisted(() => vi.fn());
vi.mock('sonner', () => ({ toast: { success: toastSuccess } }));

const fetchMock = vi.fn();

function renderHost(path = '/posts?category=Tech') {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}><FeedbackHost /></MemoryRouter>
    </QueryClientProvider>,
  );
}
const open = () => act(() => openFeedback());
const typeMessage = (text: string) => fireEvent.change(screen.getByLabelText('Your message'), { target: { value: text } });
const sentBody = () => JSON.parse(fetchMock.mock.calls[0][1].body);

beforeEach(() => {
  toastSuccess.mockReset();
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
  app.user = null;
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, status: 201, json: async () => ({ success: true, data: { id: 9 } }) });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('stays closed until something calls openFeedback()', () => {
  renderHost();
  expect(screen.queryByRole('dialog')).toBeNull();
  open();
  expect(screen.getByRole('dialog', { name: 'Send feedback' })).toBeInTheDocument();
});

it('sends a guest bug report with the page it came from and the optional email', async () => {
  renderHost();
  open();
  typeMessage('  The filter panel will not close on my phone.  ');
  fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: 'reader@example.com' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send feedback' }));
  await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Thank you! Your feedback was sent.', expect.anything()));
  expect(fetchMock.mock.calls[0][0]).toBe('/api/feedback');
  expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST', credentials: 'include' });
  expect(sentBody()).toEqual({ kind: 'bug', message: 'The filter panel will not close on my phone.', page: '/posts?category=Tech', contactEmail: 'reader@example.com' });
});

it('lets the reader pick a suggestion, and does not ask a signed-in reader for an email', async () => {
  app.user = { id: 7, username: 'reader' };
  renderHost('/');
  open();
  expect(screen.queryByLabelText(/^Email/)).toBeNull();
  fireEvent.click(screen.getByRole('radio', { name: 'Suggestion' }));
  expect(screen.getByRole('radio', { name: 'Suggestion' })).toHaveAttribute('aria-checked', 'true');
  typeMessage('A weekly digest would be nice.');
  fireEvent.click(screen.getByRole('button', { name: 'Send feedback' }));
  await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
  expect(sentBody()).toEqual({ kind: 'suggestion', message: 'A weekly digest would be nice.', page: '/' });
});

it('will not send a message of a word or two, and counts characters up to 2000', () => {
  renderHost();
  open();
  typeMessage('hi');
  expect(screen.getByRole('button', { name: 'Send feedback' })).toBeDisabled();
  typeMessage('x'.repeat(2100));
  expect((screen.getByLabelText('Your message') as HTMLTextAreaElement).value).toHaveLength(2000);
  expect(screen.getByText('2000/2000')).toBeInTheDocument();
});

it('shows the server\'s reason without the field name, and keeps the text for another try', async () => {
  fetchMock.mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ success: false, error: 'contactEmail: Enter a valid email address' }) });
  renderHost();
  open();
  typeMessage('Something broke on the article page.');
  fireEvent.click(screen.getByRole('button', { name: 'Send feedback' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/^Enter a valid email address$/);
  expect(screen.getByLabelText('Your message')).toHaveValue('Something broke on the article page.');
});

it('falls back to a plain message when the server gives no reason', async () => {
  fetchMock.mockResolvedValueOnce({ ok: false, status: 502, json: async () => { throw new Error('not json'); } });
  renderHost();
  open();
  typeMessage('Something broke on the article page.');
  fireEvent.click(screen.getByRole('button', { name: 'Send feedback' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not send feedback. Please try again.');
});

it('starts empty again the next time it opens after a successful send', async () => {
  renderHost();
  open();
  typeMessage('First message about the hero carousel.');
  fireEvent.click(screen.getByRole('button', { name: 'Send feedback' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  open();
  expect(screen.getByLabelText('Your message')).toHaveValue('');
});

it('a successful send closes the dialog and confirms with a toast', async () => {
  renderHost();
  open();
  typeMessage('The live view could scroll a little smoother.');
  fireEvent.click(screen.getByRole('button', { name: 'Send feedback' }));
  await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Thank you! Your feedback was sent.', expect.anything()));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
});
