import { useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarDays, ChevronDown, CreditCard, MapPin, MessageCircle, Package, Phone, Star, Truck } from 'lucide-react';
import { bookingApi, type BookingAction } from '@/services/endpoints';
import { errorMessage } from '@/services/api';
import type { Booking } from '@/types';
import { cn } from '@/utils/cn';
import { formatDate, formatDateRange, formatIDR, toDateString } from '@/utils/format';
import { BookingStatusBadge, PaymentBadge, PriceBreakdownView } from './common';
import { ContactDialog } from './ContactOwnerDialog';
import { Button } from './ui/button';
import { ConfirmDialog, Dialog, DialogContent } from './ui/dialog';
import { Textarea } from './ui/form-controls';
import { Card, SafeImage, StarInput, Stars, UserAvatar } from './ui/misc';

const ACTION_COPY: Record<BookingAction, { title: string; description: string; confirm: string; success: string; destructive?: boolean }> = {
  accept: {
    title: 'Accept this booking?',
    description: 'The dates will be reserved for this renter. Other pending requests for overlapping dates will be declined automatically.',
    confirm: 'Accept booking',
    success: 'Booking accepted — the renter has been notified',
  },
  reject: { title: 'Decline this request?', description: 'The renter will be notified that you declined.', confirm: 'Decline request', success: 'Request declined', destructive: true },
  cancel: { title: 'Cancel this booking?', description: 'This cannot be undone. The other party will be notified.', confirm: 'Cancel booking', success: 'Booking cancelled', destructive: true },
  start: { title: 'Mark as handed over?', description: 'Confirm the renter has picked up or received the item. The rental becomes active.', confirm: 'Start rental', success: 'Rental is now active' },
  complete: {
    title: 'Mark as returned?',
    description: 'Confirm the item was returned in good condition. The renter can then leave a review, and the deposit should be returned.',
    confirm: 'Complete rental',
    success: 'Rental completed',
  },
  simulate_payment: {
    title: 'Simulate payment (test mode)',
    description: 'Online payments are not live yet. This only marks the booking as "Paid (simulated)" for testing. No money is charged and no real transaction takes place.',
    confirm: 'Mark as paid (simulated)',
    success: 'Marked as paid (simulated) — no real money was charged',
  },
};

function ReviewDialog({ booking, open, onOpenChange }: { booking: Booking; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const review = useMutation({
    mutationFn: () => bookingApi.review(booking.id, { rating, comment: comment.trim() }),
    onSuccess: () => {
      toast.success('Thanks for your review!');
      qc.invalidateQueries({ queryKey: ['bookings'] });
      qc.invalidateQueries({ queryKey: ['listing', booking.listingId] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const tooShort = comment.trim().length < 10;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={`Review ${booking.owner.name}`} description={`How was renting “${booking.listingTitleSnapshot}”?`}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (rating && !tooShort) review.mutate();
          }}
        >
          <StarInput value={rating} onChange={setRating} />
          <div>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} rows={5} placeholder="Was the item as described? How was pickup and communication?" aria-label="Review" />
            <p className="mt-1 text-xs text-muted">{tooShort ? 'At least 10 characters' : `${comment.trim().length}/1000`}</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!rating || tooShort} loading={review.isPending}>
              Submit review
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function BookingCard({ booking: b }: { booking: Booking }) {
  const qc = useQueryClient();
  const [pending, setPending] = useState<BookingAction | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const isOwner = b.viewerRole === 'owner';
  const other = isOwner ? b.renter : b.owner;
  const today = toDateString(new Date());

  const action = useMutation({
    mutationFn: (a: BookingAction) => bookingApi.action(b.id, a),
    onSuccess: (_d, a) => {
      toast.success(ACTION_COPY[a].success);
      setPending(null);
      qc.invalidateQueries({ queryKey: ['bookings'] });
      qc.invalidateQueries({ queryKey: ['overview'] });
      qc.invalidateQueries({ queryKey: ['counts'] });
      qc.invalidateQueries({ queryKey: ['listing', b.listingId] });
    },
    onError: (e) => {
      toast.error(errorMessage(e));
      setPending(null);
      qc.invalidateQueries({ queryKey: ['bookings'] });
    },
  });

  const actions: { a: BookingAction; label: string; variant?: 'primary' | 'outline' | 'danger-outline' }[] = [];
  if (isOwner) {
    if (b.status === 'PENDING' && !b.isExpired) actions.push({ a: 'accept', label: 'Accept' }, { a: 'reject', label: 'Decline', variant: 'danger-outline' });
    if (b.status === 'ACCEPTED' && b.startDate <= today) actions.push({ a: 'start', label: 'Mark as handed over' });
    if (b.status === 'ACCEPTED') actions.push({ a: 'cancel', label: 'Cancel', variant: 'danger-outline' });
    if (b.status === 'ACTIVE') actions.push({ a: 'complete', label: 'Mark as returned' });
  } else {
    if (b.status === 'ACCEPTED' && b.paymentStatus === 'UNPAID') actions.push({ a: 'simulate_payment', label: 'Simulate payment', variant: 'outline' });
    if (b.status === 'PENDING' || b.status === 'ACCEPTED') actions.push({ a: 'cancel', label: b.status === 'PENDING' ? 'Withdraw request' : 'Cancel booking', variant: 'danger-outline' });
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:p-5">
        <Link to={`/items/${b.listing.id}`} className="block shrink-0 self-start overflow-hidden rounded-xl bg-stone-100 sm:w-36">
          <SafeImage src={b.listing.image} alt={b.listingTitleSnapshot} className="aspect-[4/3] w-full" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <BookingStatusBadge status={b.status} expired={b.isExpired} />
            {(b.status === 'ACCEPTED' || b.status === 'ACTIVE' || b.status === 'COMPLETED' || b.paymentStatus !== 'UNPAID') && <PaymentBadge status={b.paymentStatus} />}
            <span className="text-xs text-muted">Requested {formatDate(b.createdAt)}</span>
          </div>
          <Link to={`/items/${b.listing.id}`} className="mt-1.5 block truncate font-bold hover:underline">
            {b.listingTitleSnapshot}
          </Link>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="size-4" /> {formatDateRange(b.startDate, b.endDate)} · {b.rentalDays} day{b.rentalDays > 1 ? 's' : ''}
            </span>
            <span className="flex items-center gap-1.5">
              {b.fulfillmentMethod === 'DELIVERY' ? <Truck className="size-4" /> : <Package className="size-4" />}
              {b.fulfillmentMethod === 'DELIVERY' ? 'Delivery' : 'Self pickup'}
            </span>
          </div>
          <div className="mt-3 flex items-center gap-2.5">
            <UserAvatar name={other.name} src={other.profileImage} className="size-8" />
            <div className="min-w-0 text-sm">
              <p className="truncate">
                <span className="text-muted">{isOwner ? 'Renter' : 'Owner'}:</span>{' '}
                <Link to={`/users/${other.id}`} className="font-semibold hover:underline">
                  {other.name}
                </Link>
              </p>
              {other.phone && (
                <p className="flex items-center gap-1 text-xs text-muted">
                  <Phone className="size-3" /> {other.phone}
                </p>
              )}
            </div>
            <Button variant="ghost" size="icon-sm" className="ml-auto" onClick={() => setContactOpen(true)} aria-label={`Message ${other.name}`}>
              <MessageCircle />
            </Button>
          </div>
        </div>
        <div className="flex flex-row items-end justify-between gap-2 sm:flex-col sm:items-end">
          <div className="text-right">
            <p className="text-xs text-muted">Total incl. deposit</p>
            <p className="text-lg font-extrabold">{formatIDR(b.totalPrice)}</p>
          </div>
          <button onClick={() => setExpanded((e) => !e)} className="flex items-center gap-1 text-xs font-semibold text-brand-700" aria-expanded={expanded}>
            Price details <ChevronDown className={cn('size-3.5 transition-transform', expanded && 'rotate-180')} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="grid gap-6 border-t border-line bg-stone-50/60 p-5 sm:grid-cols-2">
          <PriceBreakdownView
            breakdown={{
              rentalDays: b.rentalDays,
              dailyPrice: b.dailyPriceSnapshot,
              rentalSubtotal: b.rentalPriceSnapshot,
              discount: b.dailyPriceSnapshot * b.rentalDays - b.rentalPriceSnapshot,
              deliveryFee: b.deliveryFeeSnapshot,
              securityDeposit: b.depositSnapshot,
              totalDue: b.totalPrice,
            }}
          />
          <div className="space-y-3 text-sm">
            <p className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-muted" />
              <span>
                {[b.listing.district, b.listing.city].filter(Boolean).join(', ')}
                <span className="block text-muted">{b.listing.address}</span>
              </span>
            </p>
            {b.renterNote && (
              <p>
                <span className="font-semibold">Renter's note:</span> <span className="text-muted">{b.renterNote}</span>
              </p>
            )}
            {b.ownerNote && (
              <p>
                <span className="font-semibold">Owner's note:</span> <span className="text-muted">{b.ownerNote}</span>
              </p>
            )}
            <p className="text-xs text-muted">Prices are fixed at the time of the request and won't change if the owner updates the listing.</p>
            {!other.phone && b.status === 'PENDING' && <p className="text-xs text-muted">Phone numbers are shared once the booking is accepted.</p>}
          </div>
        </div>
      )}

      {(actions.length > 0 || b.canReview || b.review) && (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-4 py-3 sm:px-5">
          {b.review && (
            <p className="mr-auto flex items-center gap-2 text-sm text-muted">
              <Stars value={b.review.rating} /> {isOwner ? 'Renter reviewed you' : 'You reviewed this rental'}
            </p>
          )}
          {b.canReview && (
            <Button size="sm" onClick={() => setReviewOpen(true)}>
              <Star /> Leave a review
            </Button>
          )}
          {actions.map(({ a, label, variant }) => (
            <Button key={a} size="sm" variant={variant ?? 'primary'} onClick={() => setPending(a)}>
              {a === 'simulate_payment' && <CreditCard />}
              {label}
            </Button>
          ))}
        </div>
      )}

      {pending && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setPending(null)}
          title={ACTION_COPY[pending].title}
          description={ACTION_COPY[pending].description}
          confirmLabel={ACTION_COPY[pending].confirm}
          destructive={ACTION_COPY[pending].destructive}
          loading={action.isPending}
          onConfirm={() => action.mutate(pending)}
        />
      )}
      {reviewOpen && <ReviewDialog booking={b} open={reviewOpen} onOpenChange={setReviewOpen} />}
      {contactOpen && <ContactDialog open={contactOpen} onOpenChange={setContactOpen} recipient={other} listing={{ id: b.listing.id, title: b.listingTitleSnapshot }} />}
    </Card>
  );
}
