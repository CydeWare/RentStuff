import { useQuery } from '@tanstack/react-query';
import { metaApi } from '@/services/endpoints';

export function useCategories() {
  return useQuery({
    queryKey: ['meta', 'categories'],
    queryFn: () => metaApi.categories().then((r) => r.items),
    staleTime: 10 * 60 * 1000,
  });
}

export function useLocations() {
  return useQuery({
    queryKey: ['meta', 'locations'],
    queryFn: () => metaApi.locations().then((r) => r.items),
    staleTime: Infinity,
  });
}

/** Public server configuration, e.g. which social logins are enabled. */
export function useAppConfig() {
  return useQuery({
    queryKey: ['meta', 'config'],
    queryFn: metaApi.config,
    staleTime: 10 * 60 * 1000,
  });
}
