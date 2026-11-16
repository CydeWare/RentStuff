import { useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Eye, Heart, Inbox, MoreHorizontal, Package, Pause, Pencil, Play, Plus, Trash2 } from 'lucide-react';
import { listingApi } from '@/services/endpoints';
import { errorMessage } from '@/services/api';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Dropdown, DropdownContent, DropdownItem, DropdownSeparator, DropdownTrigger } from '@/components/ui/dropdown';
import { Badge, Card, EmptyState, ErrorState, PageHeader, Rating, SafeImage, Skeleton } from '@/components/ui/misc';
import { formatIDR } from '@/utils/format';
import type { MyListing } from '@/types';

const STATUS: Record<string, { label: string; tone: 'green' | 'amber' | 'red' }> = {
  ACTIVE: { label: 'Active', tone: 'green' },
  PAUSED: { label: 'Paused', tone: 'amber' },
  REMOVED: { label: 'Removed by Rentora', tone: 'red' },
};

function ListingRow({ l, onDelete }: { l: MyListing; onDelete: (l: MyListing) => void }) {
  const qc = useQueryClient();
  const status = useMutation({
    mutationFn: (s: 'ACTIVE' | 'PAUSED') => listingApi.setStatus(l.id, s),
    onSuccess: (_d, s) => {
      toast.success(s === 'PAUSED' ? 'Listing paused — hidden from search' : 'Listing is live again');
      qc.invalidateQueries({ queryKey: ['my-listings'] });
      qc.invalidateQueries({ queryKey: ['listings'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const st = STATUS[l.status] ?? STATUS.ACTIVE!;

  return (
    <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
      <Link to={`/items/${l.id}`} className="shrink-0 overflow-hidden rounded-xl sm:w-32">
        <SafeImage src={l.image} alt={l.title} className="aspect-[4/3] w-full" />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={st.tone}>{st.label}</Badge>
          <span className="text-xs text-muted">{l.category.name}</span>
        </div>
        <Link to={`/items/${l.id}`} className="mt-1 block truncate font-bold hover:underline">
          {l.title}
        </Link>
        <p className="mt-0.5 text-sm">
          <span className="font-bold">{formatIDR(l.dailyPrice)}</span>
          <span className="text-muted"> /day · deposit {formatIDR(l.securityDeposit)}</span>
        </p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          <Rating value={l.ratingAvg} count={l.reviewCount} />
          <span className="flex items-center gap-1">
            <Heart className="size-3.5" /> {l.favoriteCount} saves
          </span>
          <span>{l.bookingCount} bookings</span>
          {l.pendingRequests > 0 && (
            <Link to="/dashboard/requests" className="flex items-center gap-1 font-semibold text-amber-700">
              <Inbox className="size-3.5" /> {l.pendingRequests} pending request{l.pendingRequests > 1 ? 's' : ''}
            </Link>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {l.status !== 'REMOVED' && (
          <Button variant="outline" size="sm" asChild>
            <Link to={`/listings/${l.id}/edit`}>
              <Pencil /> Edit
            </Link>
          </Button>
        )}
        <Dropdown>
          <DropdownTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="More actions">
              <MoreHorizontal />
            </Button>
          </DropdownTrigger>
          <DropdownContent>
            <DropdownItem asChild>
              <Link to={`/items/${l.id}`}>
                <Eye /> View listing
              </Link>
            </DropdownItem>
            {l.status === 'ACTIVE' && (
              <DropdownItem onSelect={() => status.mutate('PAUSED')}>
                <Pause /> Pause listing
              </DropdownItem>
            )}
            {l.status === 'PAUSED' && (
              <DropdownItem onSelect={() => status.mutate('ACTIVE')}>
                <Play /> Reactivate listing
              </DropdownItem>
            )}
            <DropdownSeparator />
            <DropdownItem onSelect={() => onDelete(l)} className="text-red-600 [&_svg]:text-red-500">
              <Trash2 /> Delete listing
            </DropdownItem>
          </DropdownContent>
        </Dropdown>
      </div>
    </Card>
  );
}

export function MyListingsPage() {
  const qc = useQueryClient();
  const [toDelete, setToDelete] = useState<MyListing | null>(null);
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ['my-listings'], queryFn: () => listingApi.mine().then((r) => r.items) });
  const del = useMutation({
    mutationFn: (id: string) => listingApi.remove(id),
    onSuccess: () => {
      toast.success('Listing deleted');
      setToDelete(null);
      qc.invalidateQueries({ queryKey: ['my-listings'] });
      qc.invalidateQueries({ queryKey: ['listings'] });
      qc.invalidateQueries({ queryKey: ['overview'] });
    },
    onError: (e) => {
      toast.error(errorMessage(e));
      setToDelete(null);
    },
  });

  return (
    <div>
      <PageHeader
        title="My listings"
        description="Manage the items you rent out."
        actions={
          <Button asChild>
            <Link to="/listings/new">
              <Plus /> New listing
            </Link>
          </Button>
        }
      />
      {isError ? (
        <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : data!.length === 0 ? (
        <EmptyState
          icon={Package}
          title="You haven't listed anything yet"
          description="Earn money from things you rarely use. Listing takes about 3 minutes."
          action={
            <Button asChild>
              <Link to="/listings/new">Start listing</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {data!.map((l) => (
            <ListingRow key={l.id} l={l} onDelete={setToDelete} />
          ))}
        </div>
      )}
      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Delete this listing?"
        description={
          <>
            “{toDelete?.title}” will be removed from {`Rentora`}. Pending requests will be declined. Listings with accepted or active bookings can't
            be deleted until those bookings finish.
          </>
        }
        confirmLabel="Delete listing"
        destructive
        loading={del.isPending}
        onConfirm={() => toDelete && del.mutate(toDelete.id)}
      />
    </div>
  );
}
