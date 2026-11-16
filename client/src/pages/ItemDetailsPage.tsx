import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DayPicker, type DateRange as PickerRange } from 'react-day-picker';
import 'react-day-picker/style.css';
import { addDays, startOfToday } from 'date-fns';
import { toast } from 'sonner';
import {
  AlertCircle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Flag,
  Heart,
  Info,
  MapPin,
  MessageCircle,
  Package,
  Pencil,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import { bookingApi, listingApi } from '@/services/endpoints';
import { errorMessage } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { useFavoriteToggle } from '@/hooks/useFavorite';
import { useDebounced } from '@/hooks/useMediaQuery';
import { PriceBreakdownView } from '@/components/common';
import { ContactDialog } from '@/components/ContactOwnerDialog';
import { Button } from '@/components/ui/button';
import { Field, Select, Textarea } from '@/components/ui/form-controls';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge, Card, ErrorState, Rating, SafeImage, Skeleton, Stars, UserAvatar } from '@/components/ui/misc';
import { cn } from '@/utils/cn';
import {
  CONDITION_HINTS,
  CONDITION_LABELS,
  REPORT_REASONS,
  formatDate,
  formatDateRange,
  formatIDR,
  parseDate,
  toDateString,
} from '@/utils/format';
import type { FulfillmentMethod, ListingDetail } from '@/types';

function Gallery({ images, title }: { images: ListingDetail['images']; title: string }) {
  const [index, setIndex] = useState(0);
  const current = images[index];
  const go = (d: number) => setIndex((i) => (i + d + images.length) % images.length);
  return (
    <div>
      <div className="relative aspect-[4/3] overflow-hidden rounded-[22px] bg-stone-100">
        <SafeImage src={current?.imageUrl} alt={`${title} photo ${index + 1}`} className="size-full" />
        {images.length > 1 && (
          <>
            <button onClick={() => go(-1)} className="absolute left-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow" aria-label="Previous photo">
              <ChevronLeft className="size-5" />
            </button>
            <button onClick={() => go(1)} className="absolute right-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow" aria-label="Next photo">
              <ChevronRight className="size-5" />
            </button>
            <span className="absolute bottom-3 right-3 rounded-full bg-ink/70 px-2.5 py-1 text-xs font-semibold text-white">
              {index + 1} / {images.length}
            </span>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={img.id}
              onClick={() => setIndex(i)}
              className={cn('size-20 shrink-0 overflow-hidden rounded-xl border-2', i === index ? 'border-brand-600' : 'border-transparent opacity-70 hover:opacity-100')}
              aria-label={`Show photo ${i + 1}`}
            >
              <SafeImage src={img.imageUrl} alt="" className="size-full" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ReportDialog({ listingId, open, onOpenChange }: { listingId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const report = useMutation({
    mutationFn: () => listingApi.report(listingId, { reason, description: description.trim() || undefined }),
    onSuccess: () => {
      toast.success('Thanks — our team will review this listing.');
      onOpenChange(false);
      setReason('');
      setDescription('');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Report this listing" description="Reports are confidential. The owner will not see who reported them.">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (reason) report.mutate();
          }}
        >
          <Field label="Reason" htmlFor="report-reason" required>
            <Select id="report-reason" value={reason} onChange={(e) => setReason(e.target.value)} required>
              <option value="">Choose a reason</option>
              {Object.entries(REPORT_REASONS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Details (optional)" htmlFor="report-desc">
            <Textarea id="report-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} placeholder="Tell us what is wrong" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" disabled={!reason} loading={report.isPending}>
              Submit report
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BookingPanel({ listing }: { listing: ListingDetail }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const [range, setRange] = useState<PickerRange | undefined>();
  const [method, setMethod] = useState<FulfillmentMethod>(listing.pickupAvailable ? 'PICKUP' : 'DELIVERY');
  const [note, setNote] = useState('');

  const today = startOfToday();
  const disabled = useMemo(
    () => [
      { before: today },
      { after: addDays(today, 365) },
      ...listing.unavailable.map((u) => ({ from: parseDate(u.startDate), to: parseDate(u.endDate) })),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [listing.unavailable],
  );
  const booked = useMemo(() => listing.unavailable.map((u) => ({ from: parseDate(u.startDate), to: parseDate(u.endDate) })), [listing.unavailable]);

  const startDate = range?.from ? toDateString(range.from) : null;
  const endDate = range?.from ? toDateString(range.to ?? range.from) : null;
  const quoteKey = useDebounced({ startDate, endDate, method }, 150);

  const quote = useQuery({
    queryKey: ['quote', listing.id, quoteKey],
    queryFn: () => listingApi.quote(listing.id, { startDate: quoteKey.startDate!, endDate: quoteKey.endDate!, fulfillmentMethod: quoteKey.method }),
    enabled: Boolean(quoteKey.startDate && quoteKey.endDate),
  });

  const book = useMutation({
    mutationFn: () => bookingApi.create({ listingId: listing.id, startDate: startDate!, endDate: endDate!, fulfillmentMethod: method, note: note.trim() || undefined }),
    onSuccess: () => {
      toast.success('Booking request sent! The owner will review it soon.');
      qc.invalidateQueries({ queryKey: ['bookings'] });
      navigate('/dashboard/rentals');
    },
    onError: (e) => {
      toast.error(errorMessage(e));
      qc.invalidateQueries({ queryKey: ['listing', listing.id] });
      quote.refetch();
    },
  });

  const quoteMatches = quote.data && quoteKey.startDate === startDate && quoteKey.endDate === endDate && quoteKey.method === method;
  const canBook = Boolean(startDate && quoteMatches && quote.data?.available && !book.isPending);

  if (listing.isOwner) {
    return (
      <Card className="p-6">
        <p className="font-bold">This is your listing</p>
        <p className="mt-1 text-sm text-muted">You can't book your own item. Manage availability and pricing from your dashboard.</p>
        <div className="mt-4 flex flex-col gap-2">
          <Button asChild>
            <Link to={`/listings/${listing.id}/edit`}>
              <Pencil /> Edit listing
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/dashboard/requests">View booking requests</Link>
          </Button>
        </div>
      </Card>
    );
  }

  if (listing.status !== 'ACTIVE') {
    return (
      <Card className="p-6">
        <p className="font-bold">Not available for booking</p>
        <p className="mt-1 text-sm text-muted">This listing is currently {listing.status === 'PAUSED' ? 'paused by the owner' : 'unavailable'}.</p>
      </Card>
    );
  }

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-baseline justify-between">
        <p>
          <span className="text-2xl font-extrabold">{formatIDR(listing.dailyPrice)}</span>
          <span className="text-muted"> /day</span>
        </p>
        <Rating value={listing.ratingAvg} count={listing.reviewCount} size="md" />
      </div>
      {(listing.weeklyPrice || listing.monthlyPrice) && (
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {listing.weeklyPrice && <Badge tone="brand">{formatIDR(listing.weeklyPrice)} / week</Badge>}
          {listing.monthlyPrice && <Badge tone="brand">{formatIDR(listing.monthlyPrice)} / month</Badge>}
        </div>
      )}

      <div className="mt-5">
        <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <CalendarDays className="size-4 text-brand-700" /> Choose rental dates
        </p>
        <div className="flex justify-center overflow-x-auto rounded-2xl border border-line p-2">
          <DayPicker
            mode="range"
            selected={range}
            onSelect={setRange}
            disabled={disabled}
            excludeDisabled
            modifiers={{ booked }}
            modifiersClassNames={{ booked: 'rdp-booked' }}
            startMonth={today}
            endMonth={addDays(today, 365)}
            weekStartsOn={1}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-3 rounded bg-[repeating-linear-gradient(-45deg,transparent_0_2px,#d6d3cd_2px_4px)]" /> Unavailable
          </span>
          {range?.from && (
            <button className="font-semibold text-brand-700 hover:underline" onClick={() => setRange(undefined)}>
              Clear dates
            </button>
          )}
        </div>
        {startDate && endDate && (
          <p className="mt-3 rounded-xl bg-stone-50 px-3 py-2 text-sm">
            <span className="font-semibold">{formatDateRange(startDate, endDate)}</span>
            {!range?.to && <span className="text-muted"> · tap another day to set the return date</span>}
          </p>
        )}
        {(listing.minRentalDays > 1 || listing.maxRentalDays) && (
          <p className="mt-2 text-xs text-muted">
            Rental period: {listing.minRentalDays > 1 ? `min ${listing.minRentalDays} days` : ''}
            {listing.minRentalDays > 1 && listing.maxRentalDays ? ', ' : ''}
            {listing.maxRentalDays ? `max ${listing.maxRentalDays} days` : ''}
          </p>
        )}
      </div>

      <div className="mt-5">
        <p className="mb-2 text-sm font-semibold">How do you want to get it?</p>
        <div className="grid grid-cols-2 gap-2">
          {(['PICKUP', 'DELIVERY'] as const).map((m) => {
            const available = m === 'PICKUP' ? listing.pickupAvailable : listing.deliveryAvailable;
            return (
              <button
                key={m}
                type="button"
                disabled={!available}
                onClick={() => setMethod(m)}
                aria-pressed={method === m}
                className={cn(
                  'rounded-xl border p-3 text-left text-sm transition',
                  method === m ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-100' : 'border-line hover:border-stone-300',
                  !available && 'cursor-not-allowed opacity-40',
                )}
              >
                <span className="flex items-center gap-1.5 font-semibold">
                  {m === 'PICKUP' ? <Package className="size-4" /> : <Truck className="size-4" />}
                  {m === 'PICKUP' ? 'Self pickup' : 'Delivery'}
                </span>
                <span className="mt-0.5 block text-xs text-muted">
                  {!available ? 'Not offered' : m === 'PICKUP' ? 'Free' : `+${formatIDR(listing.deliveryFee)}`}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {startDate && (
        <div className="mt-5">
          {quote.isFetching && !quoteMatches ? (
            <Skeleton className="h-40" />
          ) : quote.data && !quote.data.available ? (
            <p className="flex gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-800" role="alert">
              <AlertCircle className="mt-0.5 size-4 shrink-0" /> {quote.data.reason}
            </p>
          ) : quote.data?.breakdown ? (
            <PriceBreakdownView breakdown={quote.data.breakdown} />
          ) : quote.isError ? (
            <p className="text-sm text-red-700">{errorMessage(quote.error)}</p>
          ) : null}
        </div>
      )}

      {user && startDate && quote.data?.available && (
        <Field label="Message to the owner (optional)" htmlFor="booking-note" className="mt-5">
          <Textarea id="booking-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="What will you use it for? When would you like to pick it up?" />
        </Field>
      )}

      {user ? (
        <Button size="lg" className="mt-5 w-full" disabled={!canBook} loading={book.isPending} onClick={() => book.mutate()}>
          {startDate ? 'Request booking' : 'Select dates to continue'}
        </Button>
      ) : (
        <Button size="lg" className="mt-5 w-full" onClick={() => navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`)}>
          Log in to book
        </Button>
      )}
      <p className="mt-3 flex items-start gap-1.5 text-xs text-muted">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        You won't be charged now. The owner must accept your request first. Online payment is not live yet; this MVP uses a clearly
        labeled simulated payment step.
      </p>
    </Card>
  );
}

export function ItemDetailsPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toggle, pending } = useFavoriteToggle();
  const [contactOpen, setContactOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['listing', id],
    queryFn: () => listingApi.get(id).then((r) => r.listing),
  });

  if (isLoading) {
    return (
      <div className="container-page grid gap-10 py-8 lg:grid-cols-[1.4fr_1fr]">
        <Skeleton className="aspect-[4/3] rounded-[22px]" />
        <Skeleton className="h-[520px]" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="container-page py-16">
        <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />
      </div>
    );
  }

  const l = data;
  const requireLogin = (fn: () => void) => () => (user ? fn() : navigate(`/login?redirect=/items/${l.id}`));

  return (
    <div className="container-page py-6 lg:py-8">
      <nav className="mb-4 text-sm text-muted" aria-label="Breadcrumb">
        <Link to="/explore" className="hover:text-ink">
          Explore
        </Link>
        <span className="mx-2">/</span>
        <Link to={`/explore?category=${l.category.slug}`} className="hover:text-ink">
          {l.category.name}
        </Link>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <div className="min-w-0">
          <Gallery images={l.images} title={l.title} />

          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="brand">{l.category.name}</Badge>
                {l.subcategory && <Badge>{l.subcategory}</Badge>}
                {l.status === 'PAUSED' && <Badge tone="amber">Paused</Badge>}
              </div>
              <h1 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">{l.title}</h1>
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                <Rating value={l.ratingAvg} count={l.reviewCount} size="md" />
                <span className="flex items-center gap-1">
                  <MapPin className="size-4" /> {[l.district, l.city].filter(Boolean).join(', ')}
                </span>
              </p>
            </div>
            {!l.isOwner && (
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => toggle(l.id, l.isFavorited)} disabled={pending} aria-pressed={l.isFavorited}>
                  <Heart className={cn(l.isFavorited && 'fill-red-500 text-red-500')} /> {l.isFavorited ? 'Saved' : 'Save'}
                </Button>
                <Button variant="ghost" onClick={requireLogin(() => setReportOpen(true))} aria-label="Report listing">
                  <Flag /> <span className="hidden sm:inline">Report</span>
                </Button>
              </div>
            )}
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-line bg-white p-4">
              <p className="text-xs font-semibold uppercase text-muted">Condition</p>
              <p className="mt-1 font-bold">{CONDITION_LABELS[l.condition]}</p>
              <p className="text-xs text-muted">{CONDITION_HINTS[l.condition]}</p>
            </div>
            <div className="rounded-2xl border border-line bg-white p-4">
              <p className="text-xs font-semibold uppercase text-muted">Security deposit</p>
              <p className="mt-1 font-bold">{formatIDR(l.securityDeposit)}</p>
              <p className="text-xs text-muted">Refundable after return</p>
            </div>
            <div className="rounded-2xl border border-line bg-white p-4">
              <p className="text-xs font-semibold uppercase text-muted">Fulfillment</p>
              <p className="mt-1 font-bold">{[l.pickupAvailable && 'Pickup', l.deliveryAvailable && 'Delivery'].filter(Boolean).join(' · ')}</p>
              <p className="text-xs text-muted">{l.deliveryAvailable ? `Delivery fee ${formatIDR(l.deliveryFee)}` : 'Self pickup only'}</p>
            </div>
          </div>

          <section className="mt-8">
            <h2 className="text-lg font-bold">About this item</h2>
            <p className="mt-3 whitespace-pre-line leading-relaxed text-ink/90">{l.description}</p>
          </section>

          <section className="mt-8">
            <h2 className="text-lg font-bold">Pricing</h2>
            <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-white">
              {[
                ['Daily', formatIDR(l.dailyPrice)],
                ['Weekly (7 days)', l.weeklyPrice ? formatIDR(l.weeklyPrice) : '—'],
                ['Monthly (30 days)', l.monthlyPrice ? formatIDR(l.monthlyPrice) : '—'],
                ['Refundable security deposit', formatIDR(l.securityDeposit)],
                ['Delivery fee', l.deliveryAvailable ? formatIDR(l.deliveryFee) : 'Not offered'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-line px-4 py-3 text-sm last:border-0">
                  <span className="text-muted">{k}</span>
                  <span className="font-semibold">{v}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-lg font-bold">Location</h2>
            <div className="mt-3 flex gap-3 rounded-2xl border border-line bg-white p-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                <MapPin className="size-5" />
              </span>
              <div className="text-sm">
                <p className="font-semibold">{[l.district, l.city, l.province].filter(Boolean).join(', ')}</p>
                <p className="mt-0.5 text-muted">{l.address}</p>
                <p className="mt-2 text-xs text-muted">Exact meeting point is arranged with the owner after your booking is accepted.</p>
              </div>
            </div>
          </section>

          {/* Owner */}
          <section className="mt-8">
            <h2 className="text-lg font-bold">Meet the owner</h2>
            <div className="mt-3 rounded-2xl border border-line bg-white p-5">
              <div className="flex items-center gap-4">
                <UserAvatar name={l.owner.name} src={l.owner.profileImage} className="size-14 text-lg" />
                <div className="min-w-0 flex-1">
                  <Link to={`/users/${l.owner.id}`} className="font-bold hover:underline">
                    {l.owner.name}
                  </Link>
                  <p className="text-sm text-muted">
                    {l.owner.city} · Member since {formatDate(l.owner.createdAt, 'MMM yyyy')}
                  </p>
                  <div className="mt-1 flex items-center gap-3 text-sm">
                    <Rating value={l.owner.ratingAvg} count={l.owner.ratingCount} />
                    <span className="text-muted">{l.owner.listingCount} listings</span>
                  </div>
                </div>
                {!l.isOwner && (
                  <Button variant="outline" onClick={requireLogin(() => setContactOpen(true))}>
                    <MessageCircle /> <span className="hidden sm:inline">Message</span>
                  </Button>
                )}
              </div>
              {l.owner.bio && <p className="mt-4 text-sm leading-relaxed text-muted">{l.owner.bio}</p>}
            </div>
          </section>

          {/* Reviews */}
          <section className="mt-8">
            <h2 className="text-lg font-bold">
              Reviews {l.reviewCount > 0 && <span className="text-muted">({l.reviewCount})</span>}
            </h2>
            {l.reviews.length === 0 ? (
              <p className="mt-3 rounded-2xl border border-dashed border-line bg-white p-6 text-center text-sm text-muted">
                No reviews yet. Reviews appear after completed rentals.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {l.reviews.map((r) => (
                  <li key={r.id} className="rounded-2xl border border-line bg-white p-5">
                    <div className="flex items-center gap-3">
                      <UserAvatar name={r.reviewer.name} src={r.reviewer.profileImage} className="size-9" />
                      <div className="flex-1">
                        <p className="text-sm font-bold">{r.reviewer.name}</p>
                        <p className="text-xs text-muted">{formatDate(r.createdAt)}</p>
                      </div>
                      <Stars value={r.rating} />
                    </div>
                    <p className="mt-3 text-sm leading-relaxed">{r.comment}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <BookingPanel listing={l} />
          <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted">
            <ShieldCheck className="size-4 text-brand-600" /> Dates are only reserved once the owner accepts.
          </p>
        </aside>
      </div>

      {contactOpen && <ContactDialog open={contactOpen} onOpenChange={setContactOpen} recipient={l.owner} listing={{ id: l.id, title: l.title }} />}
      <ReportDialog listingId={l.id} open={reportOpen} onOpenChange={setReportOpen} />
    </div>
  );
}
