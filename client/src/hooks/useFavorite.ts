import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router';
import { toast } from 'sonner';
import { listingApi } from '@/services/endpoints';
import { errorMessage } from '@/services/api';
import { useAuth } from './useAuth';

export function useFavoriteToggle() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const mutation = useMutation({
    mutationFn: ({ id, favorite }: { id: string; favorite: boolean }) =>
      favorite ? listingApi.favorite(id) : listingApi.unfavorite(id),
    onSuccess: (_d, { favorite }) => {
      toast.success(favorite ? 'Saved to favorites' : 'Removed from favorites');
      qc.invalidateQueries({ queryKey: ['listings'] });
      qc.invalidateQueries({ queryKey: ['listing'] });
      qc.invalidateQueries({ queryKey: ['favorites'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return {
    toggle: (id: string, currentlyFavorited: boolean) => {
      if (!user) {
        toast.info('Log in to save favorites');
        navigate(`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`);
        return;
      }
      mutation.mutate({ id, favorite: !currentlyFavorited });
    },
    pending: mutation.isPending,
  };
}
