import { afterEach, describe, expect, it, vi } from 'vitest';
import { mem0Service } from './mem0Service';

afterEach(() => vi.restoreAllMocks());

describe('profile personalization service', () => {
  it('uses the HttpOnly cookie session instead of a local bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { enabled: true, topics: ['science'] } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await mem0Service.getUserPreferences();
    expect(result).toEqual({ enabled: true, topics: ['science'] });
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ credentials: 'include' });
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });
});
