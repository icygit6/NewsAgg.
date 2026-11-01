import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { usePublicationRefresh } from './usePublicationRefresh';

afterEach(() => vi.unstubAllGlobals());

it('treats the first revision as the baseline and refreshes articles only when it changes', async () => {
  let revision = 'r1';
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ success: true, data: { revision } })));
  vi.stubGlobal('fetch', fetchMock);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  renderHook(() => usePublicationRefresh(), { wrapper });

  await waitFor(() => expect(client.getQueryData(['publication-revision'])).toBe('r1'));
  // The page's own queries just loaded this publication: no second download.
  expect(invalidate).not.toHaveBeenCalled();

  await client.refetchQueries({ queryKey: ['publication-revision'] });
  expect(invalidate).not.toHaveBeenCalled();

  revision = 'r2';
  await client.refetchQueries({ queryKey: ['publication-revision'] });
  await waitFor(() => expect(invalidate).toHaveBeenCalledTimes(1));
});
