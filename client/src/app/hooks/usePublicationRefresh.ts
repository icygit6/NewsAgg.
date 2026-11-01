import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL } from '../lib/apiFetch';

export function usePublicationRefresh() {
  const client = useQueryClient();
  const { data } = useQuery({
    queryKey: ['publication-revision'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/stats/revision`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Publication status unavailable');
      const result = await response.json();
      if (!result.success || typeof result.data?.revision !== 'string') throw new Error('Invalid publication status');
      return result.data.revision as string;
    },
    staleTime: 0,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
  const seen = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (data === undefined) return;
    const previous = seen.current;
    seen.current = data;
    // Refetch only when published articles actually changed, not every tick.
    // The first answer is the baseline: the page's queries just loaded that
    // same publication, so refetching them would only download it twice.
    if (previous === undefined || previous === data) return;
    void client.invalidateQueries({ predicate: query => ['articles', 'article', 'headlines', 'latest', 'stats', 'article-explanation'].includes(String(query.queryKey[0])) });
  }, [data, client]);
}
