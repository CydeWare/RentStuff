import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Heart } from 'lucide-react';
import { meApi } from '@/services/endpoints';
import { errorMessage } from '@/services/api';
import { ListingCard, ListingCardSkeleton, ListingGrid } from '@/components/ListingCard';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, PageHeader } from '@/components/ui/misc';

export function FavoritesPage() {
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ['favorites'], queryFn: () => meApi.favorites().then((r) => r.items) });
  return (
    <div>
      <PageHeader title="Favorites" description="Items you've saved for later." />
      {isError ? (
        <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />
      ) : isLoading ? (
        <ListingGrid className="xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <ListingCardSkeleton key={i} />
          ))}
        </ListingGrid>
      ) : data!.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="No favorites yet"
          description="Tap the heart on any item to save it here."
          action={
            <Button asChild variant="outline">
              <Link to="/explore">Explore items</Link>
            </Button>
          }
        />
      ) : (
        <ListingGrid className="xl:grid-cols-3">
          {data!.map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </ListingGrid>
      )}
    </div>
  );
}
