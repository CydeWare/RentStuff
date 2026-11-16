import type { BookingStatus, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { formatRangeId } from '../utils/format.js';
import { calculatePrice, type PriceBreakdown } from '../utils/pricing.js';
import { inclusiveDayCount, parseDateOnly, todayInMarket, toDateString, validateRentalRange } from '../utils/dates.js';
import { CONFIRMED_STATUSES, nextStatus, type BookingAction } from './booking.rules.js';
import { notify } from './notification.service.js';
import { publicUserSelect } from './selects.js';

type Tx = Prisma.TransactionClient;

interface RangeInput {
  startDate: string;
  endDate: string;
  fulfillmentMethod: 'PICKUP' | 'DELIVERY';
}

type ListingForBooking = Prisma.ListingGetPayload<{ include: { owner: { select: { status: true } } } }>;

async function findBookableListing(db: Tx | typeof prisma, listingId: string): Promise<ListingForBooking> {
  const listing = await db.listing.findUnique({ where: { id: listingId }, include: { owner: { select: { status: true } } } });
  if (!listing || listing.status === 'DELETED' || listing.status === 'REMOVED' || listing.owner.status !== 'ACTIVE') {
    throw ApiError.notFound('Listing not found');
  }
  return listing;
}

/** Throws when the listing/date/fulfillment combination is not bookable. Shared by quote and create. */
function assertBasicRules(listing: ListingForBooking, input: RangeInput, renterId?: string) {
  if (renterId && listing.ownerId === renterId) throw ApiError.badRequest('You cannot rent your own item');
  if (listing.status !== 'ACTIVE') throw ApiError.conflict('This listing is currently paused by the owner');
  if (input.fulfillmentMethod === 'DELIVERY' && !listing.deliveryAvailable) {
    throw ApiError.badRequest('The owner does not offer delivery for this item');
  }
  if (input.fulfillmentMethod === 'PICKUP' && !listing.pickupAvailable) {
    throw ApiError.badRequest('This item is delivery only');
  }
  const rangeError = validateRentalRange(input.startDate, input.endDate, {
    minDays: listing.minRentalDays,
    maxDays: listing.maxRentalDays,
  });
  if (rangeError) throw ApiError.badRequest(rangeError);
}

/** Returns a human-readable reason when the dates clash with confirmed bookings or owner blocks. */
async function findConflict(db: Tx | typeof prisma, listingId: string, start: Date, end: Date, excludeBookingId?: string) {
  const [booking, block] = await Promise.all([
    db.booking.findFirst({
      where: {
        listingId,
        status: { in: CONFIRMED_STATUSES },
        startDate: { lte: end },
        endDate: { gte: start },
        ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
      },
      select: { startDate: true, endDate: true },
    }),
    db.listingBlockedDate.findFirst({
      where: { listingId, startDate: { lte: end }, endDate: { gte: start } },
      select: { startDate: true, endDate: true },
    }),
  ]);
  if (booking) return `Already booked ${formatRangeId(booking.startDate, booking.endDate)}`;
  if (block) return `The owner marked ${formatRangeId(block.startDate, block.endDate)} as unavailable`;
  return null;
}

function priceFor(listing: ListingForBooking, input: RangeInput): PriceBreakdown {
  const start = parseDateOnly(input.startDate);
  const end = parseDateOnly(input.endDate);
  return calculatePrice({
    dailyPrice: listing.dailyPrice,
    weeklyPrice: listing.weeklyPrice,
    monthlyPrice: listing.monthlyPrice,
    securityDeposit: listing.securityDeposit,
    deliveryFee: listing.deliveryFee,
    rentalDays: inclusiveDayCount(start, end),
    delivery: input.fulfillmentMethod === 'DELIVERY',
  });
}

/** Price quote + availability check used by the item page before submitting a request. */
export async function quote(listingId: string, input: RangeInput, userId?: string) {
  const listing = await findBookableListing(prisma, listingId);
  try {
    assertBasicRules(listing, input, userId);
  } catch (e) {
    if (e instanceof ApiError && e.status < 500) {
      return { available: false, reason: e.message, breakdown: null };
    }
    throw e;
  }
  const conflict = await findConflict(prisma, listingId, parseDateOnly(input.startDate), parseDateOnly(input.endDate));
  return { available: !conflict, reason: conflict, breakdown: priceFor(listing, input) };
}

function isOverlapConstraintError(e: unknown) {
  const msg = e instanceof Error ? e.message : '';
  return msg.includes('Booking_no_overlapping_confirmed') || msg.includes('23P01');
}

async function lockListing(tx: Tx, listingId: string) {
  // Serializes booking decisions per listing so two concurrent accepts cannot both succeed.
  await tx.$queryRaw`SELECT id FROM "Listing" WHERE id = ${listingId} FOR UPDATE`;
}

export async function createBooking(renterId: string, input: RangeInput & { listingId: string; note?: string }) {
  const booking = await prisma.$transaction(async (tx) => {
    await lockListing(tx, input.listingId);
    const listing = await findBookableListing(tx, input.listingId);
    assertBasicRules(listing, input, renterId);

    const start = parseDateOnly(input.startDate);
    const end = parseDateOnly(input.endDate);
    const conflict = await findConflict(tx, listing.id, start, end);
    if (conflict) throw ApiError.conflict(`These dates are not available. ${conflict}.`);

    const duplicate = await tx.booking.findFirst({
      where: { listingId: listing.id, renterId, status: 'PENDING', startDate: { lte: end }, endDate: { gte: start } },
      select: { id: true },
    });
    if (duplicate) throw ApiError.conflict('You already have a pending request for these dates');

    const price = priceFor(listing, input);
    const created = await tx.booking.create({
      data: {
        listingId: listing.id,
        renterId,
        ownerId: listing.ownerId,
        startDate: start,
        endDate: end,
        rentalDays: price.rentalDays,
        fulfillmentMethod: input.fulfillmentMethod,
        dailyPriceSnapshot: listing.dailyPrice,
        rentalPriceSnapshot: price.rentalSubtotal,
        depositSnapshot: price.securityDeposit,
        deliveryFeeSnapshot: price.deliveryFee,
        totalPrice: price.totalDue,
        listingTitleSnapshot: listing.title,
        renterNote: input.note || null,
      },
      include: { renter: { select: { name: true } } },
    });

    await notify(
      {
        userId: listing.ownerId,
        type: 'BOOKING_REQUEST',
        title: 'New booking request',
        message: `${created.renter.name} wants to rent "${listing.title}" for ${formatRangeId(start, end)}.`,
        link: `/dashboard/requests`,
      },
      tx,
    );
    return created;
  });
  return getBooking(booking.id, { id: renterId, role: 'USER', name: '' });
}

const bookingInclude = {
  listing: {
    select: {
      id: true,
      title: true,
      city: true,
      district: true,
      address: true,
      status: true,
      images: { orderBy: { displayOrder: 'asc' as const }, take: 1, select: { imageUrl: true } },
    },
  },
  renter: { select: { ...publicUserSelect, phone: true } },
  owner: { select: { ...publicUserSelect, phone: true } },
  review: { select: { id: true, rating: true, comment: true, createdAt: true } },
} satisfies Prisma.BookingInclude;

type BookingRow = Prisma.BookingGetPayload<{ include: typeof bookingInclude }>;

const CONTACT_VISIBLE: BookingStatus[] = ['ACCEPTED', 'ACTIVE', 'COMPLETED'];

/** Shapes a booking for the API, hiding phone numbers until the booking is accepted. */
function serialize(b: BookingRow, viewerId: string) {
  const showContact = CONTACT_VISIBLE.includes(b.status);
  const { phone: renterPhone, ...renter } = b.renter;
  const { phone: ownerPhone, ...owner } = b.owner;
  const today = todayInMarket();
  return {
    ...b,
    startDate: toDateString(b.startDate),
    endDate: toDateString(b.endDate),
    listing: { ...b.listing, image: b.listing.images[0]?.imageUrl ?? null, images: undefined },
    renter: { ...renter, phone: showContact ? renterPhone : null },
    owner: { ...owner, phone: showContact ? ownerPhone : null },
    viewerRole: b.ownerId === viewerId ? ('owner' as const) : b.renterId === viewerId ? ('renter' as const) : ('admin' as const),
    canReview: b.renterId === viewerId && b.status === 'COMPLETED' && !b.review,
    isExpired: b.status === 'PENDING' && b.startDate < today,
  };
}

export async function getBooking(id: string, viewer: Express.AuthUser) {
  const b = await prisma.booking.findUnique({ where: { id }, include: bookingInclude });
  if (!b) throw ApiError.notFound('Booking not found');
  if (b.renterId !== viewer.id && b.ownerId !== viewer.id && viewer.role !== 'ADMIN') {
    // 404 rather than 403 so booking ids cannot be probed.
    throw ApiError.notFound('Booking not found');
  }
  return serialize(b, viewer.id);
}

export async function listBookings(userId: string, role: 'renter' | 'owner', statuses: BookingStatus[]) {
  const rows = await prisma.booking.findMany({
    where: {
      ...(role === 'renter' ? { renterId: userId } : { ownerId: userId }),
      ...(statuses.length ? { status: { in: statuses } } : {}),
    },
    orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
    include: bookingInclude,
    take: 200,
  });
  return rows.map((r) => serialize(r, userId));
}

const ACTION_COPY: Record<Exclude<BookingAction, 'simulate_payment'>, { type: 'BOOKING_ACCEPTED' | 'BOOKING_REJECTED' | 'BOOKING_CANCELLED' | 'BOOKING_ACTIVE' | 'BOOKING_COMPLETED'; title: string }> = {
  accept: { type: 'BOOKING_ACCEPTED', title: 'Booking accepted' },
  reject: { type: 'BOOKING_REJECTED', title: 'Booking declined' },
  cancel: { type: 'BOOKING_CANCELLED', title: 'Booking cancelled' },
  start: { type: 'BOOKING_ACTIVE', title: 'Rental started' },
  complete: { type: 'BOOKING_COMPLETED', title: 'Rental completed' },
};

export async function applyAction(bookingId: string, actor: Express.AuthUser, action: BookingAction, note?: string) {
  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.booking.findUnique({ where: { id: bookingId }, select: { listingId: true } });
      if (!existing) throw ApiError.notFound('Booking not found');
      await lockListing(tx, existing.listingId);
      const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
      const today = todayInMarket();
      const status = nextStatus(booking, action, actor.id, today);

      if (action === 'simulate_payment') {
        await tx.booking.update({ where: { id: bookingId }, data: { paymentStatus: 'SIMULATED_PAID' } });
        return;
      }

      if (action === 'accept') {
        const conflict = await findConflict(tx, booking.listingId, booking.startDate, booking.endDate, booking.id);
        if (conflict) throw ApiError.conflict(`Cannot accept: ${conflict}.`);
      }

      const isOwner = actor.id === booking.ownerId;
      await tx.booking.update({
        where: { id: bookingId },
        data: {
          status,
          ...(note ? (isOwner ? { ownerNote: note } : { renterNote: note }) : {}),
          ...(status === 'CANCELLED' && booking.paymentStatus === 'SIMULATED_PAID' ? { paymentStatus: 'SIMULATED_REFUNDED' } : {}),
        },
      });

      const range = formatRangeId(booking.startDate, booking.endDate);
      const title = booking.listingTitleSnapshot;
      const copy = ACTION_COPY[action];
      const recipient = isOwner ? booking.renterId : booking.ownerId;
      const messages: Record<typeof action, string> = {
        accept: `Your request for "${title}" (${range}) was accepted. The dates are now reserved for you.`,
        reject: `Your request for "${title}" (${range}) was declined by the owner.`,
        cancel: `The booking for "${title}" (${range}) was cancelled by the ${isOwner ? 'owner' : 'renter'}.`,
        start: `Your rental of "${title}" is now active. Enjoy, and remember to return it by ${toDateString(booking.endDate)}.`,
        complete: `Your rental of "${title}" is complete. Please leave a review for the owner.`,
      };
      await notify(
        {
          userId: recipient,
          type: copy.type,
          title: copy.title,
          message: messages[action],
          link: recipient === booking.ownerId ? '/dashboard/requests' : '/dashboard/rentals',
        },
        tx,
      );

      // Once dates are reserved, other pending requests for overlapping dates can no longer be accepted.
      if (action === 'accept') {
        const overlapping = await tx.booking.findMany({
          where: {
            listingId: booking.listingId,
            status: 'PENDING',
            id: { not: booking.id },
            startDate: { lte: booking.endDate },
            endDate: { gte: booking.startDate },
          },
          select: { id: true, renterId: true, startDate: true, endDate: true },
        });
        if (overlapping.length) {
          await tx.booking.updateMany({
            where: { id: { in: overlapping.map((o) => o.id) } },
            data: { status: 'REJECTED', ownerNote: 'Dates were booked by another renter' },
          });
          for (const o of overlapping) {
            await notify(
              {
                userId: o.renterId,
                type: 'BOOKING_REJECTED',
                title: 'Booking declined',
                message: `Your request for "${title}" (${formatRangeId(o.startDate, o.endDate)}) was declined because the dates were booked by someone else.`,
                link: '/dashboard/rentals',
              },
              tx,
            );
          }
        }
      }
    });
  } catch (e) {
    if (isOverlapConstraintError(e)) throw ApiError.conflict('Cannot accept: the dates overlap another confirmed booking.');
    throw e;
  }
  return getBooking(bookingId, actor);
}

export async function dashboardOverview(userId: string) {
  const [activeRentals, upcomingRentals, pendingIncoming, pendingOutgoing, listings, earnings, recentAsOwner, recentAsRenter] =
    await Promise.all([
      prisma.booking.count({ where: { renterId: userId, status: 'ACTIVE' } }),
      prisma.booking.count({ where: { renterId: userId, status: 'ACCEPTED' } }),
      prisma.booking.count({ where: { ownerId: userId, status: 'PENDING', startDate: { gte: todayInMarket() } } }),
      prisma.booking.count({ where: { renterId: userId, status: 'PENDING' } }),
      prisma.listing.groupBy({ by: ['status'], where: { ownerId: userId, status: { not: 'DELETED' } }, _count: true }),
      prisma.booking.aggregate({
        where: { ownerId: userId, status: 'COMPLETED' },
        _sum: { rentalPriceSnapshot: true, deliveryFeeSnapshot: true },
        _count: true,
      }),
      prisma.booking.findMany({ where: { ownerId: userId }, orderBy: { updatedAt: 'desc' }, take: 5, include: bookingInclude }),
      prisma.booking.findMany({ where: { renterId: userId }, orderBy: { updatedAt: 'desc' }, take: 5, include: bookingInclude }),
    ]);

  const listingCounts = Object.fromEntries(listings.map((l) => [l.status, l._count]));
  const recent = [...recentAsOwner, ...recentAsRenter]
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 6)
    .map((b) => serialize(b, userId));

  return {
    activeRentals,
    upcomingRentals,
    pendingIncoming,
    pendingOutgoing,
    listings: {
      total: listings.reduce((s, l) => s + l._count, 0),
      active: listingCounts.ACTIVE ?? 0,
      paused: listingCounts.PAUSED ?? 0,
    },
    // Earnings = rental fees + delivery fees of completed rentals (deposits are refundable, not earnings).
    totalEarnings: (earnings._sum.rentalPriceSnapshot ?? 0) + (earnings._sum.deliveryFeeSnapshot ?? 0),
    completedAsOwner: earnings._count,
    recent,
  };
}
