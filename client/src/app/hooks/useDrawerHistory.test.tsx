import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { createMemoryRouter, Outlet, RouterProvider, useLocation, useNavigate } from 'react-router';
import { afterEach, expect, it } from 'vitest';
import { useDrawerHistory } from './useDrawerHistory';

afterEach(cleanup);

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// A drawer row navigates and closes the drawer at once, like ProfileSidebar's goTo.
function Shell() {
  const [open, setOpen] = useState(false);
  useDrawerHistory(open, setOpen);
  const location = useLocation();
  const navigate = useNavigate();
  const go = (path: string) => {
    navigate(path, { replace: (location.state as { drawer?: boolean } | null)?.drawer === true });
    setOpen(false);
  };
  return (
    <>
      <button onClick={() => setOpen(true)}>open</button>
      <button onClick={() => go('/slow')}>slow</button>
      <button onClick={() => go('/fast')}>fast</button>
      <button onClick={() => setOpen(false)}>close</button>
      <p role="status">{`${location.pathname}${open ? ' open' : ''}`}</p>
      <Outlet />
    </>
  );
}

function setup() {
  const router = createMemoryRouter([{
    path: '/',
    Component: Shell,
    children: [
      { index: true, Component: () => null },
      // A page whose code is still downloading when the drawer's own history step would be dropped.
      { path: 'slow', lazy: async () => { await wait(700); return { Component: () => null }; } },
      { path: 'fast', Component: () => null },
    ],
  }], { initialEntries: ['/'] });
  render(<RouterProvider router={router} />);
  return router;
}

async function openDrawer() {
  act(() => screen.getByText('open').click());
  // Let the drawer push its history entry.
  await act(() => wait(400));
}

it('a drawer link to a page that is still loading still arrives there', async () => {
  const router = setup();
  await openDrawer();
  act(() => screen.getByText('slow').click());
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/^\/slow$/), { timeout: 2000 });
  // The drawer's entry was replaced, so back returns to where it was opened.
  await act(() => router.navigate(-1));
  expect(screen.getByRole('status')).toHaveTextContent(/^\/$/);
});

it('a drawer link to a loaded page arrives and leaves no drawer entry behind', async () => {
  const router = setup();
  await openDrawer();
  act(() => screen.getByText('fast').click());
  await act(() => wait(500));
  expect(screen.getByRole('status')).toHaveTextContent(/^\/fast$/);
  await act(() => router.navigate(-1));
  expect(screen.getByRole('status')).toHaveTextContent(/^\/$/);
});

it('closing the drawer without a link drops its history entry', async () => {
  const router = setup();
  await openDrawer();
  expect(router.state.location.state).toEqual({ drawer: true });
  act(() => screen.getByText('close').click());
  await act(() => wait(500));
  expect(router.state.location.state).toBeNull();
  expect(router.state.historyAction).toBe('POP');
  expect(screen.getByRole('status')).toHaveTextContent(/^\/$/);
});
