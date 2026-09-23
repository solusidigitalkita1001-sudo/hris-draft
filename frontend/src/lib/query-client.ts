import { QueryClient, type QueryKey } from '@tanstack/react-query';
import { useCompanyStore } from '@/stores/company.store';

const COMPANY_QUERY_PREFIX = 'company';

/**
 * All tenant-aware React Query consumers must build their key through this
 * helper so records from two companies can never share a cache entry.
 */
export function companyQueryKey(
  activeCompanyId: string,
  ...parts: QueryKey
): QueryKey {
  return [COMPANY_QUERY_PREFIX, activeCompanyId, ...parts];
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
    },
  },
});

useCompanyStore.subscribe((state, previousState) => {
  const previousCompanyId = previousState.activeCompanyId;
  if (!previousCompanyId || previousCompanyId === state.activeCompanyId) return;

  const belongsToPreviousCompany = (query: { queryKey: readonly unknown[] }) =>
    query.queryKey[0] === COMPANY_QUERY_PREFIX
    && query.queryKey[1] === previousCompanyId;

  void queryClient.cancelQueries({ predicate: belongsToPreviousCompany });
  queryClient.removeQueries({ predicate: belongsToPreviousCompany });
});
