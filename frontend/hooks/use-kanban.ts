import useSWR from 'swr';
import base_api from '@/lib/axios-config';

// Generic SWR hook shared by the GE and quotation kanbans. Both endpoints
// answer GET {baseUrl}/kanban returning { columns } and share the same polling
// and cache behaviour, so the fetcher, key builder and SWR options live here to
// avoid duplicating them per domain (any future polling/cache tweak is one edit).

export const buildKanbanKey = (
  baseUrl: string,
  params?: Record<string, string | undefined>,
): string => {
  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(params ?? {})) {
    if (value) search.set(name, value);
  }
  const query = search.toString();
  return query ? `${baseUrl}/kanban?${query}` : `${baseUrl}/kanban`;
};

export const useKanban = <T>(
  baseUrl: string,
  params?: Record<string, string | undefined>,
) => {
  const key = buildKanbanKey(baseUrl, params);

  const { data: board, error, mutate, isValidating } = useSWR<T>(
    key,
    async (url: string) => {
      const response = await base_api.get<{ columns: T }>(url);
      return response.data.columns;
    },
    {
      refreshInterval: 30000,
      revalidateOnFocus: false,
      // Keep the current board mounted while a new query revalidates so the page
      // does not fall back to the full-page loader (which unmounts the filters
      // bar and drops the search input focus) when the key changes.
      keepPreviousData: true,
    },
  );

  return {
    board,
    isLoading: !error && !board,
    isError: !!error,
    isValidating,
    mutate,
  };
};
