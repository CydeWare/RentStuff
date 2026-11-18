import { useQuery } from '@tanstack/react-query';
import { meApi } from '@/services/endpoints';
import { useAuth } from './useAuth';

/** Unread notification + message counts for navigation badges (polled). */
export function useCounts() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['counts'],
    queryFn: meApi.counts,
    enabled: Boolean(user),
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });
}
