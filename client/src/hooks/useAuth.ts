import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/services/endpoints';
import type { Me } from '@/types';

export const ME_KEY = ['me'] as const;

export function useAuth() {
  const { data, isLoading } = useQuery({
    queryKey: ME_KEY,
    queryFn: () => authApi.me().then((r) => r.user),
    staleTime: 5 * 60 * 1000,
  });
  return { user: data ?? null, isLoading, isAdmin: data?.role === 'ADMIN' };
}

/** Replaces cached user and clears user-specific caches after login/logout. */
function useSetSession() {
  const qc = useQueryClient();
  return (user: Me | null) => {
    qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'meta' && q.queryKey[0] !== 'me' });
    qc.setQueryData(ME_KEY, user);
  };
}

export function useLogin() {
  const setSession = useSetSession();
  return useMutation({
    mutationFn: authApi.login,
    onSuccess: ({ user }) => setSession(user),
  });
}

export function useRegister() {
  const setSession = useSetSession();
  return useMutation({
    mutationFn: authApi.register,
    onSuccess: ({ user }) => setSession(user),
  });
}

export function useLogout() {
  const setSession = useSetSession();
  return useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => setSession(null),
  });
}
