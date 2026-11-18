import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CalendarDays, MapPin, MessageCircle, SearchX, Star } from 'lucide-react';
import { notificationApi, userApi } from '@/services/endpoints';
import { errorMessage } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { ListingCard, ListingGrid } from '@/components/ListingCard';
import { ContactDialog } from '@/components/ContactOwnerDialog';
import { Button } from '@/components/ui/button';
import { Card, EmptyState, ErrorState, PageHeader, Pagination, Rating, Skeleton, Spinner, Stars, UserAvatar } from '@/components/ui/misc';
import { cn } from '@/utils/cn';
import { formatDate, timeAgo } from '@/utils/format';
import { BRAND } from '@/config/brand';

export function NotificationsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ['notifications', 'page', page], queryFn: () => notificationApi.list(page) });
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['notifications'] });
    qc.invalidateQueries({ queryKey: ['counts'] });
  };
  const readAll = useMutation({ mutationFn: notificationApi.readAll, onSuccess: invalidate });
  const readOne = useMutation({ mutationFn: notificationApi.read, onSuccess: invalidate });

  return (
    <div className="container-page max-w-3xl py-10">
      <PageHeader
        title="Notifications"
        description={data ? `${data.unread} unread` : undefined}
        actions={
          data && data.unread > 0 ? (
            <Button variant="outline" onClick={() => readAll.mutate()} loading={readAll.isPending}>
              Mark all as read
            </Button>
          ) : undefined
        }
      />
      {isError ? (
        <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />
      ) : isLoading ? (
        <Spinner />
      ) : data!.items.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications yet" description="Booking updates and new messages will appear here." />
      ) : (
        <>
          <Card className="divide-y divide-line">
            {data!.items.map((n) => (
              <div key={n.id} className={cn('flex gap-3 p-4', !n.isRead && 'bg-brand-50/40')}>
                <span className={cn('mt-2 size-2 shrink-0 rounded-full', n.isRead ? 'bg-transparent' : 'bg-brand-600')} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">{n.title}</p>
                  <p className="text-sm text-muted">{n.message}</p>
                  <p className="mt-1 text-xs text-stone-400">{timeAgo(n.createdAt)}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {n.link && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (!n.isRead) readOne.mutate(n.id);
                        navigate(n.link!);
                      }}
                    >
                      View
                    </Button>
                  )}
                  {!n.isRead && (
                    <button className="text-xs font-semibold text-brand-700 hover:underline" onClick={() => readOne.mutate(n.id)}>
                      Mark read
                    </button>
                  )}
                </div>
              </div>
            ))}
          </Card>
          <Pagination page={page} totalPages={data!.totalPages} onChange={setPage} />
        </>
      )}
    </div>
  );
}

export function PublicProfilePage() {
  const { id = '' } = useParams();
  const { user: me } = useAuth();
  const navigate = useNavigate();
  const [contactOpen, setContactOpen] = useState(false);
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ['profile', id], queryFn: () => userApi.profile(id) });

  if (isLoading) return <div className="container-page py-10"><Skeleton className="h-48" /></div>;
  if (isError || !data) return <div className="container-page py-16"><ErrorState message={errorMessage(error)} onRetry={() => refetch()} /></div>;
  const { user, listings, reviews } = data;

  return (
    <div className="container-page py-10">
      <Card className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:p-8">
        <UserAvatar name={user.name} src={user.profileImage} className="size-24 text-2xl" />
        <div className="flex-1">
          <h1 className="text-2xl font-extrabold">{user.name}</h1>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
            <span className="flex items-center gap-1.5"><MapPin className="size-4" /> {[user.district, user.city].filter(Boolean).join(', ')}</span>
            <span className="flex items-center gap-1.5"><CalendarDays className="size-4" /> Joined {formatDate(user.createdAt, 'MMMM yyyy')}</span>
            <span className="flex items-center gap-1.5"><Star className="size-4" /> {user.completedRentals} completed rentals as owner</span>
          </div>
          <div className="mt-2"><Rating value={user.ratingAvg} count={user.ratingCount} size="md" /></div>
          {user.bio && <p className="mt-3 max-w-2xl text-sm leading-relaxed">{user.bio}</p>}
        </div>
        {me?.id !== user.id && (
          <Button variant="outline" onClick={() => (me ? setContactOpen(true) : navigate(`/login?redirect=/users/${user.id}`))}>
            <MessageCircle /> Message
          </Button>
        )}
      </Card>

      <h2 className="mb-5 mt-10 text-xl font-bold">Items from {user.name.split(' ')[0]} ({listings.length})</h2>
      {listings.length === 0 ? (
        <p className="text-muted">No active listings right now.</p>
      ) : (
        <ListingGrid>{listings.map((l) => <ListingCard key={l.id} listing={l} />)}</ListingGrid>
      )}

      <h2 className="mb-5 mt-12 text-xl font-bold">Reviews ({reviews.length})</h2>
      {reviews.length === 0 ? (
        <p className="text-muted">No reviews yet.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {reviews.map((r) => (
            <Card key={r.id} className="p-5">
              <div className="flex items-center gap-3">
                <UserAvatar name={r.reviewer.name} src={r.reviewer.profileImage} className="size-9" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">{r.reviewer.name}</p>
                  <p className="truncate text-xs text-muted">
                    {formatDate(r.createdAt)}
                    {r.listing && <> · rented <Link to={`/items/${r.listing.id}`} className="underline">{r.listing.title}</Link></>}
                  </p>
                </div>
                <Stars value={r.rating} />
              </div>
              <p className="mt-3 text-sm leading-relaxed">{r.comment}</p>
            </Card>
          ))}
        </div>
      )}
      {contactOpen && <ContactDialog open={contactOpen} onOpenChange={setContactOpen} recipient={user} />}
    </div>
  );
}

const INFO: Record<string, { title: string; sections: { id?: string; heading: string; body: string[] }[] }> = {
  about: {
    title: `About ${BRAND.name}`,
    sections: [
      {
        heading: 'Why we exist',
        body: [
          'Most of us own things we use a few times a year, and regularly need things we use once. Buying them is expensive and wasteful.',
          `${BRAND.name} lets neighbours rent everyday items to each other: cameras for a wedding, a tent for a weekend in Puncak, a drill to put up shelves.`,
        ],
      },
      { heading: 'Where we operate', body: ['We are starting in Jakarta and the surrounding Jabodetabek area, with a few other Indonesian cities available to list in.'] },
      { heading: 'Status', body: ['This is an MVP. Payments are simulated and no real money moves through the platform yet.'] },
    ],
  },
  help: {
    title: 'Help Center',
    sections: [
      { heading: 'How do I rent an item?', body: ['Open an item, choose your dates and pickup or delivery, then send a booking request. The owner accepts or declines. Accepted dates are reserved for you.'] },
      { heading: 'What is the security deposit?', body: ['A refundable amount set by the owner to protect the item. It is shown separately from the rental fee and is returned when the item comes back in the same condition.'] },
      { heading: 'How do payments work?', body: ['Online payment is not live in this version. After a booking is accepted, the renter can mark it as “Paid (simulated)” for testing; no money is charged. Arrange real payment directly with the owner until online payment launches.'] },
      { heading: 'Can I cancel?', body: ['Renters and owners can cancel a booking while it is pending or accepted. The other party is notified.'] },
      { heading: 'How do I list an item?', body: ['Click “List your item”, add photos, a description, your daily price, deposit and pickup location. You can pause or edit your listing any time.'] },
      { id: 'safety', heading: 'Trust & safety tips', body: ['Meet in public places for pickups. Check the item together and take photos at handover and return. Keep conversations on Rentora so there is a record. Report suspicious listings with the “Report” button.'] },
    ],
  },
  contact: {
    title: 'Contact us',
    sections: [
      { heading: 'Support', body: [`Email ${BRAND.supportEmail}. This is a demo address for the MVP and is not monitored.`] },
      { heading: 'Report a problem with a listing', body: ['Use the “Report” button on the listing page so our team can review it quickly.'] },
    ],
  },
  terms: {
    title: 'Terms of Service',
    sections: [
      { heading: 'Draft terms', body: ['These are placeholder terms for an MVP demo and are not legally binding. Final terms will be published before launch.'] },
      { heading: 'Responsibilities', body: ['Owners are responsible for accurate listings and safe items. Renters are responsible for returning items on time and in the same condition.'] },
      { heading: 'Prohibited items', body: ['Weapons, illegal goods, hazardous materials and items you do not own may not be listed.'] },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    sections: [
      { heading: 'Draft policy', body: ['This is a placeholder policy for an MVP demo.'] },
      { heading: 'What we show publicly', body: ['Your name, profile photo, city, bio, listings and reviews. Your email is never shown. Your phone number is shared only with the other party once a booking is accepted.'] },
      { heading: 'Security', body: ['Passwords are hashed and sessions use secure HTTP-only cookies.'] },
    ],
  },
};

export function InfoPage({ page }: { page: keyof typeof INFO }) {
  const info = INFO[page]!;
  return (
    <div className="container-page max-w-3xl py-12">
      <h1 className="text-3xl font-extrabold tracking-tight">{info.title}</h1>
      <div className="mt-8 space-y-8">
        {info.sections.map((s) => (
          <section key={s.heading} id={s.id} className="scroll-mt-24">
            <h2 className="text-lg font-bold">{s.heading}</h2>
            {s.body.map((p, i) => (
              <p key={i} className="mt-2 leading-relaxed text-muted">{p}</p>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <div className="container-page py-20">
      <EmptyState
        icon={SearchX}
        title="Page not found"
        description="The page you're looking for doesn't exist or has moved."
        action={<Button asChild><Link to="/">Back to home</Link></Button>}
      />
    </div>
  );
}
