import { useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import * as Tabs from '@radix-ui/react-tabs';
import { CalendarCheck, Inbox } from 'lucide-react';
import { bookingApi } from '@/services/endpoints';
import { errorMessage } from '@/services/api';
import { BookingCard } from '@/components/BookingCard';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/ui/misc';
import { cn } from '@/utils/cn';
import { toDateString } from '@/utils/format';
import type { Booking } from '@/types';

interface TabDef {
  value: string;
  label: string;
  filter: (b: Booking, today: string) => boolean;
}

const RENTER_TABS: TabDef[] = [
  { value: 'upcoming', label: 'Upcoming', filter: (b) => (b.status === 'PENDING' && !b.isExpired) || b.status === 'ACCEPTED' },
  { value: 'active', label: 'Active', filter: (b) => b.status === 'ACTIVE' },
  { value: 'completed', label: 'Completed', filter: (b) => b.status === 'COMPLETED' },
  { value: 'cancelled', label: 'Cancelled', filter: (b) => b.status === 'CANCELLED' || b.status === 'REJECTED' || b.isExpired },
];

const OWNER_TABS: TabDef[] = [
  { value: 'pending', label: 'Pending', filter: (b) => b.status === 'PENDING' && !b.isExpired },
  { value: 'upcoming', label: 'Accepted', filter: (b) => b.status === 'ACCEPTED' },
  { value: 'active', label: 'Active', filter: (b) => b.status === 'ACTIVE' },
  { value: 'history', label: 'History', filter: (b) => ['COMPLETED', 'CANCELLED', 'REJECTED'].includes(b.status) || b.isExpired },
];

function BookingTabs({ role, tabs }: { role: 'renter' | 'owner'; tabs: TabDef[] }) {
  const [tab, setTab] = useState(tabs[0]!.value);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['bookings', role],
    queryFn: () => bookingApi.list(role).then((r) => r.items),
    refetchInterval: 30_000,
  });
  const today = toDateString(new Date());

  return (
    <Tabs.Root value={tab} onValueChange={setTab}>
      <Tabs.List className="mb-5 flex gap-1 overflow-x-auto rounded-2xl bg-stone-100 p-1" aria-label="Booking status">
        {tabs.map((t) => {
          const count = data?.filter((b) => t.filter(b, today)).length ?? 0;
          return (
            <Tabs.Trigger
              key={t.value}
              value={t.value}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-muted transition data-[state=active]:bg-white data-[state=active]:text-ink data-[state=active]:shadow-sm',
              )}
            >
              {t.label}
              {count > 0 && <span className="rounded-full bg-stone-200 px-1.5 text-xs text-ink">{count}</span>}
            </Tabs.Trigger>
          );
        })}
      </Tabs.List>
      {tabs.map((t) => (
        <Tabs.Content key={t.value} value={t.value} className="space-y-4 outline-none">
          {isError ? (
            <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />
          ) : isLoading ? (
            Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-40" />)
          ) : (
            (() => {
              const list = data!.filter((b) => t.filter(b, today));
              if (list.length === 0) {
                return role === 'renter' ? (
                  <EmptyState
                    icon={CalendarCheck}
                    title={`No ${t.label.toLowerCase()} rentals`}
                    description="When you request to rent an item, it will show up here."
                    action={
                      <Button asChild variant="outline">
                        <Link to="/explore">Find something to rent</Link>
                      </Button>
                    }
                  />
                ) : (
                  <EmptyState icon={Inbox} title={`No ${t.label.toLowerCase()} requests`} description="Booking requests for your listings will appear here." />
                );
              }
              return list.map((b) => <BookingCard key={b.id} booking={b} />);
            })()
          )}
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
}

export function MyRentalsPage() {
  return (
    <div>
      <PageHeader title="My rentals" description="Items you've requested or rented from others." />
      <BookingTabs role="renter" tabs={RENTER_TABS} />
    </div>
  );
}

export function BookingRequestsPage() {
  return (
    <div>
      <PageHeader title="Booking requests" description="Requests from renters for your listed items. Accept, decline and track handovers." />
      <BookingTabs role="owner" tabs={OWNER_TABS} />
    </div>
  );
}
