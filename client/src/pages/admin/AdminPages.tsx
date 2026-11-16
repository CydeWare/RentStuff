import { useState } from 'react';
import { Link } from 'react-router';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Ban, CalendarRange, CheckCircle2, Flag, Package, RotateCcw, Search, Trash2, Users, Wallet } from 'lucide-react';
import { adminApi, type AdminQuery } from '@/services/endpoints';
import { errorMessage } from '@/services/api';
import { useDebounced } from '@/hooks/useMediaQuery';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Input, Select } from '@/components/ui/form-controls';
import { Badge, Card, EmptyState, ErrorState, PageHeader, Pagination, SafeImage, Skeleton, Spinner, UserAvatar } from '@/components/ui/misc';
import { BookingStatusBadge, PaymentBadge } from '@/components/common';
import { formatDate, formatDateRange, formatIDR, REPORT_REASONS } from '@/utils/format';
import type { BookingStatus, PaymentStatus } from '@/types';

function useAdminList<T>(key: string, fetcher: (q: AdminQuery) => Promise<T>) {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const debouncedQ = useDebounced(q, 300);
  const query = useQuery({
    queryKey: ['admin', key, page, debouncedQ, status],
    queryFn: () => fetcher({ page, q: debouncedQ || undefined, status: status || undefined }),
    placeholderData: keepPreviousData,
  });
  return {
    query,
    page,
    setPage,
    q,
    setQ: (v: string) => {
      setQ(v);
      setPage(1);
    },
    status,
    setStatus: (v: string) => {
      setStatus(v);
      setPage(1);
    },
  };
}

function Toolbar({ q, setQ, status, setStatus, statuses, placeholder }: { q?: string; setQ?: (v: string) => void; status: string; setStatus: (v: string) => void; statuses: string[]; placeholder?: string }) {
  return (
    <div className="mb-4 flex flex-col gap-2 sm:flex-row">
      {setQ && (
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} className="pl-10" aria-label="Search" />
        </div>
      )}
      <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-48" aria-label="Filter by status">
        <option value="">All statuses</option>
        {statuses.map((s) => (
          <option key={s} value={s}>
            {s.charAt(0) + s.slice(1).toLowerCase()}
          </option>
        ))}
      </Select>
    </div>
  );
}

const th = 'px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-muted';
const td = 'px-4 py-3 align-middle';

export function AdminOverviewPage() {
  const { data, isLoading, isError, error } = useQuery({ queryKey: ['admin', 'stats'], queryFn: adminApi.stats });
  if (isError) return <ErrorState message={errorMessage(error)} />;
  if (isLoading || !data) return <Spinner />;
  const totalBookings = Object.values(data.bookings).reduce((a, b) => a + b, 0);
  const cards = [
    { icon: Users, label: 'Registered users', value: data.users, hint: `${data.newUsers7d} new this week · ${data.suspendedUsers} suspended`, to: '/admin/users' },
    { icon: Package, label: 'Active listings', value: data.listings.ACTIVE ?? 0, hint: `${data.listings.PAUSED ?? 0} paused · ${data.listings.REMOVED ?? 0} removed`, to: '/admin/listings' },
    { icon: CalendarRange, label: 'Bookings', value: totalBookings, hint: `${data.bookings.PENDING ?? 0} pending · ${data.bookings.ACTIVE ?? 0} active`, to: '/admin/bookings' },
    { icon: Flag, label: 'Open reports', value: data.openReports, hint: 'Need review', to: '/admin/reports' },
    { icon: Wallet, label: 'Completed rental value', value: formatIDR(data.completedRentalValue), hint: 'Rental + delivery fees, excluding deposits', to: '/admin/bookings' },
  ];
  return (
    <div>
      <PageHeader title="Platform overview" description="Basic statistics across the marketplace." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.label} to={c.to} className="rounded-2xl border border-line bg-white p-5 shadow-card hover:shadow-lift">
            <c.icon className="size-6 text-brand-700" />
            <p className="mt-4 text-2xl font-extrabold">{c.value}</p>
            <p className="text-sm font-semibold">{c.label}</p>
            <p className="text-xs text-muted">{c.hint}</p>
          </Link>
        ))}
      </div>
      <Card className="mt-6 p-5">
        <h2 className="font-bold">Bookings by status</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          {(['PENDING', 'ACCEPTED', 'ACTIVE', 'COMPLETED', 'REJECTED', 'CANCELLED'] as BookingStatus[]).map((s) => (
            <div key={s} className="flex items-center gap-2 rounded-xl bg-stone-50 px-3 py-2">
              <BookingStatusBadge status={s} />
              <span className="font-bold">{data.bookings[s] ?? 0}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export function AdminUsersPage() {
  const qc = useQueryClient();
  const list = useAdminList('users', adminApi.users);
  const [target, setTarget] = useState<{ id: string; name: string; status: 'ACTIVE' | 'SUSPENDED' } | null>(null);
  const mutate = useMutation({
    mutationFn: (t: NonNullable<typeof target>) => adminApi.setUserStatus(t.id, t.status),
    onSuccess: (_d, t) => {
      toast.success(t.status === 'SUSPENDED' ? `${t.name} suspended` : `${t.name} reactivated`);
      setTarget(null);
      qc.invalidateQueries({ queryKey: ['admin'] });
    },
    onError: (e) => {
      toast.error(errorMessage(e));
      setTarget(null);
    },
  });
  const { data, isLoading, isError, error } = list.query;
  return (
    <div>
      <PageHeader title="Users" description="Suspended users cannot log in and their listings are hidden from search." />
      <Toolbar q={list.q} setQ={list.setQ} status={list.status} setStatus={list.setStatus} statuses={['ACTIVE', 'SUSPENDED']} placeholder="Search name or email" />
      {isError ? (
        <ErrorState message={errorMessage(error)} />
      ) : isLoading ? (
        <Skeleton className="h-96" />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-line">
              <tr>
                <th className={th}>User</th>
                <th className={th}>City</th>
                <th className={th}>Listings / rentals</th>
                <th className={th}>Joined</th>
                <th className={th}>Status</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data!.items.map((u) => (
                <tr key={u.id}>
                  <td className={td}>
                    <div className="flex items-center gap-3">
                      <UserAvatar name={u.name} src={u.profileImage} className="size-9" />
                      <div>
                        <p className="font-semibold">
                          {u.name} {u.role === 'ADMIN' && <Badge tone="brand">Admin</Badge>}
                        </p>
                        <p className="text-xs text-muted">{u.email} · {u.phone}</p>
                      </div>
                    </div>
                  </td>
                  <td className={td}>{u.city}</td>
                  <td className={td}>{u._count.listings} / {u._count.rentals}</td>
                  <td className={td}>{formatDate(u.createdAt)}</td>
                  <td className={td}>
                    <Badge tone={u.status === 'ACTIVE' ? 'green' : 'red'}>{u.status === 'ACTIVE' ? 'Active' : 'Suspended'}</Badge>
                  </td>
                  <td className={`${td} text-right`}>
                    {u.role !== 'ADMIN' &&
                      (u.status === 'ACTIVE' ? (
                        <Button size="sm" variant="danger-outline" onClick={() => setTarget({ id: u.id, name: u.name, status: 'SUSPENDED' })}>
                          <Ban /> Suspend
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => setTarget({ id: u.id, name: u.name, status: 'ACTIVE' })}>
                          <RotateCcw /> Reactivate
                        </Button>
                      ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data!.items.length === 0 && <p className="p-8 text-center text-muted">No users found.</p>}
        </Card>
      )}
      <Pagination page={list.page} totalPages={data?.totalPages ?? 1} onChange={list.setPage} />
      <ConfirmDialog
        open={Boolean(target)}
        onOpenChange={(o) => !o && setTarget(null)}
        title={target?.status === 'SUSPENDED' ? `Suspend ${target?.name}?` : `Reactivate ${target?.name}?`}
        description={target?.status === 'SUSPENDED' ? 'They will be logged out immediately and their listings hidden from search.' : 'They will be able to log in again and their listings become visible.'}
        confirmLabel={target?.status === 'SUSPENDED' ? 'Suspend user' : 'Reactivate'}
        destructive={target?.status === 'SUSPENDED'}
        loading={mutate.isPending}
        onConfirm={() => target && mutate.mutate(target)}
      />
    </div>
  );
}

export function AdminListingsPage() {
  const qc = useQueryClient();
  const list = useAdminList('listings', adminApi.listings);
  const [target, setTarget] = useState<{ id: string; title: string; status: 'ACTIVE' | 'REMOVED' } | null>(null);
  const mutate = useMutation({
    mutationFn: (t: NonNullable<typeof target>) => adminApi.setListingStatus(t.id, t.status),
    onSuccess: (_d, t) => {
      toast.success(t.status === 'REMOVED' ? 'Listing removed' : 'Listing restored');
      setTarget(null);
      qc.invalidateQueries({ queryKey: ['admin'] });
      qc.invalidateQueries({ queryKey: ['listings'] });
    },
    onError: (e) => {
      toast.error(errorMessage(e));
      setTarget(null);
    },
  });
  const { data, isLoading, isError, error } = list.query;
  const tone = { ACTIVE: 'green', PAUSED: 'amber', REMOVED: 'red', DELETED: 'neutral' } as const;
  return (
    <div>
      <PageHeader title="Listings" description="Remove listings that break the rules. Removed listings disappear from search." />
      <Toolbar q={list.q} setQ={list.setQ} status={list.status} setStatus={list.setStatus} statuses={['ACTIVE', 'PAUSED', 'REMOVED', 'DELETED']} placeholder="Search by title" />
      {isError ? (
        <ErrorState message={errorMessage(error)} />
      ) : isLoading ? (
        <Skeleton className="h-96" />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-line">
              <tr>
                <th className={th}>Listing</th>
                <th className={th}>Owner</th>
                <th className={th}>Price</th>
                <th className={th}>Reports</th>
                <th className={th}>Status</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data!.items.map((l) => (
                <tr key={l.id}>
                  <td className={td}>
                    <div className="flex items-center gap-3">
                      <SafeImage src={l.images[0]?.imageUrl} alt="" className="size-12 shrink-0 rounded-lg" />
                      <div className="min-w-0">
                        <Link to={`/items/${l.id}`} className="font-semibold hover:underline">{l.title}</Link>
                        <p className="text-xs text-muted">{l.category.name} · {l.city} · {formatDate(l.createdAt)}</p>
                      </div>
                    </div>
                  </td>
                  <td className={td}>
                    <p>{l.owner.name}</p>
                    <p className="text-xs text-muted">{l.owner.email}</p>
                  </td>
                  <td className={td}>{formatIDR(l.dailyPrice)}/day</td>
                  <td className={td}>{l._count.reports > 0 ? <Badge tone="red">{l._count.reports} open</Badge> : <span className="text-muted">—</span>}</td>
                  <td className={td}><Badge tone={tone[l.status]}>{l.status.charAt(0) + l.status.slice(1).toLowerCase()}</Badge></td>
                  <td className={`${td} text-right`}>
                    {(l.status === 'ACTIVE' || l.status === 'PAUSED') && (
                      <Button size="sm" variant="danger-outline" onClick={() => setTarget({ id: l.id, title: l.title, status: 'REMOVED' })}>
                        <Trash2 /> Remove
                      </Button>
                    )}
                    {l.status === 'REMOVED' && (
                      <Button size="sm" variant="outline" onClick={() => setTarget({ id: l.id, title: l.title, status: 'ACTIVE' })}>
                        <RotateCcw /> Restore
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data!.items.length === 0 && <p className="p-8 text-center text-muted">No listings found.</p>}
        </Card>
      )}
      <Pagination page={list.page} totalPages={data?.totalPages ?? 1} onChange={list.setPage} />
      <ConfirmDialog
        open={Boolean(target)}
        onOpenChange={(o) => !o && setTarget(null)}
        title={target?.status === 'REMOVED' ? 'Remove this listing?' : 'Restore this listing?'}
        description={target?.status === 'REMOVED' ? `“${target?.title}” will be hidden from everyone, pending requests declined, and the owner notified.` : `“${target?.title}” will become visible in search again.`}
        confirmLabel={target?.status === 'REMOVED' ? 'Remove listing' : 'Restore'}
        destructive={target?.status === 'REMOVED'}
        loading={mutate.isPending}
        onConfirm={() => target && mutate.mutate(target)}
      />
    </div>
  );
}

export function AdminBookingsPage() {
  const list = useAdminList('bookings', adminApi.bookings);
  const { data, isLoading, isError, error } = list.query;
  return (
    <div>
      <PageHeader title="Bookings" description="All booking records across the platform." />
      <Toolbar q={list.q} setQ={list.setQ} status={list.status} setStatus={list.setStatus} statuses={['PENDING', 'ACCEPTED', 'ACTIVE', 'COMPLETED', 'REJECTED', 'CANCELLED']} placeholder="Search by item title" />
      {isError ? (
        <ErrorState message={errorMessage(error)} />
      ) : isLoading ? (
        <Skeleton className="h-96" />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b border-line">
              <tr>
                <th className={th}>Item</th>
                <th className={th}>Renter → Owner</th>
                <th className={th}>Dates</th>
                <th className={th}>Total</th>
                <th className={th}>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data!.items.map((b) => (
                <tr key={b.id}>
                  <td className={td}>
                    <Link to={`/items/${b.listingId}`} className="font-semibold hover:underline">{b.listingTitleSnapshot}</Link>
                    <p className="text-xs text-muted">Created {formatDate(b.createdAt)}</p>
                  </td>
                  <td className={td}>{b.renter.name} → {b.owner.name}</td>
                  <td className={td}>{formatDateRange(b.startDate, b.endDate)}<p className="text-xs text-muted">{b.rentalDays} days</p></td>
                  <td className={td}>{formatIDR(b.totalPrice)}</td>
                  <td className={td}>
                    <div className="flex flex-col items-start gap-1">
                      <BookingStatusBadge status={b.status} />
                      <PaymentBadge status={b.paymentStatus as PaymentStatus} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data!.items.length === 0 && <p className="p-8 text-center text-muted">No bookings found.</p>}
        </Card>
      )}
      <Pagination page={list.page} totalPages={data?.totalPages ?? 1} onChange={list.setPage} />
    </div>
  );
}

export function AdminReportsPage() {
  const qc = useQueryClient();
  const list = useAdminList('reports', adminApi.reports);
  const update = useMutation({
    mutationFn: (v: { id: string; status: string; removeListing?: boolean }) => adminApi.updateReport(v.id, v),
    onSuccess: (_d, v) => {
      toast.success(v.removeListing ? 'Listing removed and report resolved' : v.status === 'DISMISSED' ? 'Report dismissed' : 'Report updated');
      qc.invalidateQueries({ queryKey: ['admin'] });
      qc.invalidateQueries({ queryKey: ['listings'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const [removeTarget, setRemoveTarget] = useState<{ id: string; title: string } | null>(null);
  const { data, isLoading, isError, error } = list.query;
  return (
    <div>
      <PageHeader title="Reported listings" description="Review reports from the community." />
      <Toolbar status={list.status} setStatus={list.setStatus} statuses={['OPEN', 'RESOLVED', 'DISMISSED']} />
      {isError ? (
        <ErrorState message={errorMessage(error)} />
      ) : isLoading ? (
        <Skeleton className="h-64" />
      ) : data!.items.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="No reports" description="Nothing needs your attention right now." />
      ) : (
        <div className="space-y-3">
          {data!.items.map((r) => (
            <Card key={r.id} className="p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={r.status === 'OPEN' ? 'amber' : r.status === 'RESOLVED' ? 'green' : 'neutral'}>{r.status.charAt(0) + r.status.slice(1).toLowerCase()}</Badge>
                    <span className="text-sm font-bold">{REPORT_REASONS[r.reason] ?? r.reason}</span>
                  </div>
                  <p className="mt-2 text-sm">
                    Listing: <Link to={`/items/${r.listing.id}`} className="font-semibold hover:underline">{r.listing.title}</Link>{' '}
                    <span className="text-muted">by {r.listing.owner.name} · status {r.listing.status.toLowerCase()}</span>
                  </p>
                  {r.description && <p className="mt-1 text-sm text-muted">“{r.description}”</p>}
                  <p className="mt-2 text-xs text-muted">Reported by {r.reporter.name} ({r.reporter.email}) · {formatDate(r.createdAt)}</p>
                </div>
                {r.status === 'OPEN' && (
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => update.mutate({ id: r.id, status: 'DISMISSED' })}>Dismiss</Button>
                    <Button size="sm" variant="outline" onClick={() => update.mutate({ id: r.id, status: 'RESOLVED' })}>Resolve</Button>
                    {r.listing.status !== 'REMOVED' && (
                      <Button size="sm" variant="danger" onClick={() => setRemoveTarget({ id: r.id, title: r.listing.title })}>
                        <Trash2 /> Remove listing
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
      <Pagination page={list.page} totalPages={data?.totalPages ?? 1} onChange={list.setPage} />
      <ConfirmDialog
        open={Boolean(removeTarget)}
        onOpenChange={(o) => !o && setRemoveTarget(null)}
        title="Remove listing and resolve report?"
        description={`“${removeTarget?.title}” will be hidden from everyone and the owner notified.`}
        confirmLabel="Remove listing"
        destructive
        loading={update.isPending}
        onConfirm={() => {
          if (removeTarget) update.mutate({ id: removeTarget.id, status: 'RESOLVED', removeListing: true }, { onSettled: () => setRemoveTarget(null) });
        }}
      />
    </div>
  );
}
