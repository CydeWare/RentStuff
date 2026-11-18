import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CalendarCheck, Clock, Inbox, Package, Plus, Wallet, type LucideIcon } from 'lucide-react';
import { meApi } from '@/services/endpoints';
import { errorMessage } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, EmptyState, ErrorState, PageHeader, SafeImage, Skeleton } from '@/components/ui/misc';
import { BookingStatusBadge } from '@/components/common';
import { formatDateRange, formatIDR, timeAgo } from '@/utils/format';

function Stat({ icon: Icon, label, value, hint, to }: { icon: LucideIcon; label: string; value: React.ReactNode; hint?: string; to: string }) {
  return (
    <Link to={to} className="group rounded-2xl border border-line bg-white p-5 shadow-card transition hover:border-brand-200 hover:shadow-lift">
      <div className="flex items-center justify-between">
        <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
          <Icon className="size-5" />
        </span>
        <ArrowRight className="size-4 text-stone-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600" />
      </div>
      <p className="mt-4 text-2xl font-extrabold">{value}</p>
      <p className="text-sm font-semibold">{label}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </Link>
  );
}

export function OverviewPage() {
  const { user } = useAuth();
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ['overview'], queryFn: meApi.overview });

  return (
    <div>
      <PageHeader
        title={`Hi, ${user?.name.split(' ')[0]} 👋`}
        description="Here's what's happening with your rentals and listings."
        actions={
          <Button asChild>
            <Link to="/listings/new">
              <Plus /> List an item
            </Link>
          </Button>
        }
      />
      {isError ? (
        <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat icon={CalendarCheck} label="Active rentals" value={data.activeRentals} hint={`${data.upcomingRentals} upcoming · ${data.pendingOutgoing} awaiting owner`} to="/dashboard/rentals" />
            <Stat icon={Inbox} label="Pending requests" value={data.pendingIncoming} hint="Waiting for your decision" to="/dashboard/requests" />
            <Stat icon={Package} label="Items listed" value={data.listings.total} hint={`${data.listings.active} active · ${data.listings.paused} paused`} to="/dashboard/listings" />
            <Stat icon={Wallet} label="Total earnings" value={formatIDR(data.totalEarnings)} hint={`From ${data.completedAsOwner} completed rental${data.completedAsOwner === 1 ? '' : 's'} · deposits excluded`} to="/dashboard/requests" />
          </div>

          <h2 className="mb-3 mt-10 text-lg font-bold">Recent activity</h2>
          {data.recent.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="No activity yet"
              description="Rent something you need or list an item to start earning."
              action={
                <Button asChild variant="outline">
                  <Link to="/explore">Explore items</Link>
                </Button>
              }
            />
          ) : (
            <Card className="divide-y divide-line">
              {data.recent.map((b) => {
                const asOwner = b.viewerRole === 'owner';
                return (
                  <Link key={b.id} to={asOwner ? '/dashboard/requests' : '/dashboard/rentals'} className="flex items-center gap-4 p-4 hover:bg-stone-50">
                    <SafeImage src={b.listing.image} alt="" className="size-14 shrink-0 rounded-xl" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{b.listingTitleSnapshot}</p>
                      <p className="truncate text-xs text-muted">
                        {asOwner ? `Rented by ${b.renter.name}` : `From ${b.owner.name}`} · {formatDateRange(b.startDate, b.endDate)}
                      </p>
                    </div>
                    <div className="hidden text-right sm:block">
                      <BookingStatusBadge status={b.status} expired={b.isExpired} />
                      <p className="mt-1 text-xs text-muted">{timeAgo(b.updatedAt)}</p>
                    </div>
                  </Link>
                );
              })}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
