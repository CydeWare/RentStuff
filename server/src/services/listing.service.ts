import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { LOCATIONS } from '../config/locations.js';
import { ApiError } from '../utils/ApiError.js';
import { addDays, parseDateOnly, todayInMarket, toDateString } from '../utils/dates.js';
import type { ListingInput, SearchQuery } from '../validators/listing.validator.js';
import { listingCardInclude, publicUserSelect } from './selects.js';
import { CONFIRMED_STATUSES } from './booking.rules.js';

/** Listings that may appear to the general public. */
export const publicListingWhere: Prisma.ListingWhereInput = {
  status: 'ACTIVE',
  owner: { status: 'ACTIVE' },
};

function cardInclude(today: Date) {
  return {
    ...listingCardInclude,
    // Used to compute the "available today" badge.
    bookings: {
      where: { status: { in: CONFIRMED_STATUSES }, startDate: { lte: today }, endDate: { gte: today } },
      select: { endDate: true },
      take: 1,
    },
    blockedDates: {
      where: { startDate: { lte: today }, endDate: { gte: today } },
      select: { endDate: true },
      take: 1,
    },
  } satisfies Prisma.ListingInclude;
}

type CardRow = Prisma.ListingGetPayload<{ include: ReturnType<typeof cardInclude> }>;

function toCard(l: CardRow, favoriteIds: Set<string>) {
  const busyUntil = [...l.bookings, ...l.blockedDates].map((b) => b.endDate).sort((a, b) => b.getTime() - a.getTime())[0];
  return {
    id: l.id,
    title: l.title,
    dailyPrice: l.dailyPrice,
    weeklyPrice: l.weeklyPrice,
    monthlyPrice: l.monthlyPrice,
    securityDeposit: l.securityDeposit,
    condition: l.condition,
    city: l.city,
    district: l.district,
    status: l.status,
    ratingAvg: l.ratingAvg,
    reviewCount: l.reviewCount,
    pickupAvailable: l.pickupAvailable,
    deliveryAvailable: l.deliveryAvailable,
    createdAt: l.createdAt,
    image: l.images[0]?.imageUrl ?? null,
    category: l.category,
    owner: l.owner,
    availableToday: !busyUntil,
    availableFrom: busyUntil ? toDateString(addDays(busyUntil, 1)) : null,
    isFavorited: favoriteIds.has(l.id),
  };
}

async function favoriteSet(userId: string | undefined, listingIds: string[]) {
  if (!userId || listingIds.length === 0) return new Set<string>();
  const favs = await prisma.favorite.findMany({
    where: { userId, listingId: { in: listingIds } },
    select: { listingId: true },
  });
  return new Set(favs.map((f) => f.listingId));
}

async function toCards(rows: CardRow[], userId?: string) {
  const favs = await favoriteSet(userId, rows.map((r) => r.id));
  return rows.map((r) => toCard(r, favs));
}

/** Prisma filter: no confirmed booking or owner block overlaps [start, end]. */
export function availableBetween(start: Date, end: Date): Prisma.ListingWhereInput {
  return {
    bookings: { none: { status: { in: CONFIRMED_STATUSES }, startDate: { lte: end }, endDate: { gte: start } } },
    blockedDates: { none: { startDate: { lte: end }, endDate: { gte: start } } },
  };
}

export async function searchListings(query: SearchQuery, userId?: string) {
  const and: Prisma.ListingWhereInput[] = [publicListingWhere];

  if (query.q) {
    const words = query.q.split(/\s+/).filter(Boolean).slice(0, 8);
    for (const word of words) {
      and.push({
        OR: [
          { title: { contains: word, mode: 'insensitive' } },
          { description: { contains: word, mode: 'insensitive' } },
          { subcategory: { contains: word, mode: 'insensitive' } },
          { category: { name: { contains: word, mode: 'insensitive' } } },
        ],
      });
    }
  }
  if (query.category) and.push({ category: { slug: query.category } });
  if (query.city) {
    // A province name selects all its cities (e.g. "DKI Jakarta").
    const province = LOCATIONS.find((p) => p.name === query.city);
    and.push(province ? { province: province.name } : { city: query.city });
  }
  if (query.district) and.push({ district: query.district });
  if (query.minPrice != null) and.push({ dailyPrice: { gte: query.minPrice } });
  if (query.maxPrice != null) and.push({ dailyPrice: { lte: query.maxPrice } });
  if (query.condition.length) and.push({ condition: { in: query.condition } });
  if (query.delivery === 'true') and.push({ deliveryAvailable: true });

  const duration =
    query.duration ??
    (query.startDate && query.endDate
      ? Math.round((parseDateOnly(query.endDate).getTime() - parseDateOnly(query.startDate).getTime()) / 86_400_000) + 1
      : undefined);

  if (duration) {
    and.push({ minRentalDays: { lte: duration } });
    and.push({ OR: [{ maxRentalDays: null }, { maxRentalDays: { gte: duration } }] });
  }

  if (query.startDate) {
    const start = parseDateOnly(query.startDate);
    const end = query.endDate ? parseDateOnly(query.endDate) : addDays(start, (duration ?? 1) - 1);
    if (end < start) throw ApiError.badRequest('End date must be on or after the start date');
    and.push(availableBetween(start, end));
  }

  const orderBy: Prisma.ListingOrderByWithRelationInput[] = (() => {
    switch (query.sort) {
      case 'price_asc':
        return [{ dailyPrice: 'asc' }, { createdAt: 'desc' }];
      case 'price_desc':
        return [{ dailyPrice: 'desc' }, { createdAt: 'desc' }];
      case 'rating':
        return [{ ratingAvg: 'desc' }, { reviewCount: 'desc' }, { createdAt: 'desc' }];
      case 'newest':
        return [{ createdAt: 'desc' }];
      default:
        // Simple relevance: well-reviewed, frequently booked and recent listings first.
        return [{ reviewCount: 'desc' }, { ratingAvg: 'desc' }, { bookings: { _count: 'desc' } }, { createdAt: 'desc' }];
    }
  })();

  const where: Prisma.ListingWhereInput = { AND: and };
  const today = todayInMarket();
  const [rows, total] = await Promise.all([
    prisma.listing.findMany({
      where,
      orderBy,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      include: cardInclude(today),
    }),
    prisma.listing.count({ where }),
  ]);

  return {
    items: await toCards(rows, userId),
    total,
    page: query.page,
    limit: query.limit,
    totalPages: Math.max(1, Math.ceil(total / query.limit)),
  };
}

export async function featuredListings(
  type: 'popular' | 'recent' | 'recommended',
  limit: number,
  city: string | undefined,
  userId?: string,
) {
  const where: Prisma.ListingWhereInput = { AND: [publicListingWhere, city ? { city } : {}] };
  const orderBy: Prisma.ListingOrderByWithRelationInput[] =
    type === 'popular'
      ? [{ bookings: { _count: 'desc' } }, { favorites: { _count: 'desc' } }, { createdAt: 'desc' }]
      : type === 'recent'
        ? [{ createdAt: 'desc' }]
        : [{ ratingAvg: 'desc' }, { reviewCount: 'desc' }, { createdAt: 'desc' }];
  const rows = await prisma.listing.findMany({ where, orderBy, take: limit, include: cardInclude(todayInMarket()) });
  return toCards(rows, userId);
}

export async function categoriesWithCounts() {
  const cats = await prisma.category.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { _count: { select: { listings: { where: publicListingWhere } } } },
  });
  return cats.map(({ _count, ...c }) => ({ ...c, listingCount: _count.listings }));
}

/** Date ranges (inclusive) when the listing cannot be booked, from today onward. */
export async function unavailableRanges(listingId: string) {
  const today = todayInMarket();
  const [bookings, blocks] = await Promise.all([
    prisma.booking.findMany({
      where: { listingId, status: { in: CONFIRMED_STATUSES }, endDate: { gte: today } },
      select: { startDate: true, endDate: true },
      orderBy: { startDate: 'asc' },
    }),
    prisma.listingBlockedDate.findMany({
      where: { listingId, endDate: { gte: today } },
      select: { startDate: true, endDate: true },
      orderBy: { startDate: 'asc' },
    }),
  ]);
  return [
    ...bookings.map((b) => ({ startDate: toDateString(b.startDate), endDate: toDateString(b.endDate), reason: 'booked' as const })),
    ...blocks.map((b) => ({ startDate: toDateString(b.startDate), endDate: toDateString(b.endDate), reason: 'blocked' as const })),
  ].sort((a, b) => a.startDate.localeCompare(b.startDate));
}

export async function getListing(id: string, viewer?: Express.AuthUser) {
  const listing = await prisma.listing.findUnique({
    where: { id },
    include: {
      images: { orderBy: { displayOrder: 'asc' } },
      category: true,
      owner: { select: { ...publicUserSelect, status: true, _count: { select: { listings: { where: publicListingWhere } } } } },
      blockedDates: { orderBy: { startDate: 'asc' } },
      _count: { select: { favorites: true, bookings: { where: { status: 'COMPLETED' } } } },
    },
  });
  if (!listing) throw ApiError.notFound('Listing not found');

  const isOwner = viewer?.id === listing.ownerId;
  const isAdmin = viewer?.role === 'ADMIN';
  const publiclyVisible = listing.status === 'ACTIVE' && listing.owner.status === 'ACTIVE';
  if (!publiclyVisible && !isOwner && !isAdmin) throw ApiError.notFound('Listing not found');

  const [unavailable, isFavorited, reviews] = await Promise.all([
    unavailableRanges(id),
    viewer ? prisma.favorite.findUnique({ where: { userId_listingId: { userId: viewer.id, listingId: id } } }) : null,
    prisma.review.findMany({
      where: { listingId: id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { reviewer: { select: { id: true, name: true, profileImage: true } } },
    }),
  ]);

  const { owner, blockedDates, _count, ...rest } = listing;
  const { status: ownerStatus, _count: ownerCount, ...ownerPublic } = owner;
  void ownerStatus;

  return {
    ...rest,
    owner: { ...ownerPublic, listingCount: ownerCount.listings },
    // Owner-only detail: the raw blocked ranges (with notes) for editing.
    blockedDates: isOwner
      ? blockedDates.map((b) => ({ startDate: toDateString(b.startDate), endDate: toDateString(b.endDate), note: b.note }))
      : undefined,
    favoriteCount: _count.favorites,
    completedRentals: _count.bookings,
    unavailable,
    isFavorited: Boolean(isFavorited),
    isOwner,
    reviews,
  };
}

async function assertValidRefs(input: ListingInput) {
  const category = await prisma.category.findUnique({ where: { id: input.categoryId }, select: { id: true } });
  if (!category) throw ApiError.badRequest('Category does not exist', { fieldErrors: { categoryId: 'Choose a category' } });
  const province = LOCATIONS.find((p) => p.name === input.province);
  if (!province?.cities.some((c) => c.name === input.city)) {
    throw ApiError.badRequest('City does not belong to the selected province', { fieldErrors: { city: 'Choose a city in the selected province' } });
  }
}

function listingData(input: ListingInput) {
  return {
    title: input.title,
    description: input.description,
    categoryId: input.categoryId,
    subcategory: input.subcategory || null,
    dailyPrice: input.dailyPrice,
    weeklyPrice: input.weeklyPrice,
    monthlyPrice: input.monthlyPrice,
    securityDeposit: input.securityDeposit,
    condition: input.condition,
    province: input.province,
    city: input.city,
    district: input.district || null,
    address: input.address,
    pickupAvailable: input.pickupAvailable,
    deliveryAvailable: input.deliveryAvailable,
    deliveryFee: input.deliveryAvailable ? input.deliveryFee : 0,
    minRentalDays: input.minRentalDays,
    maxRentalDays: input.maxRentalDays,
  };
}

export async function createListing(ownerId: string, input: ListingInput) {
  await assertValidRefs(input);
  return prisma.listing.create({
    data: {
      ...listingData(input),
      ownerId,
      images: { create: input.images.map((imageUrl, i) => ({ imageUrl, displayOrder: i })) },
      blockedDates: {
        create: input.blockedDates.map((b) => ({ startDate: parseDateOnly(b.startDate), endDate: parseDateOnly(b.endDate), note: b.note })),
      },
    },
    select: { id: true },
  });
}

/** Loads a listing and verifies the user owns it. */
export async function getOwnedListing(listingId: string, userId: string) {
  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing || listing.status === 'DELETED') throw ApiError.notFound('Listing not found');
  if (listing.ownerId !== userId) throw ApiError.forbidden('You can only manage your own listings');
  return listing;
}

export async function updateListing(listingId: string, userId: string, input: ListingInput) {
  const listing = await getOwnedListing(listingId, userId);
  if (listing.status === 'REMOVED') throw ApiError.forbidden('This listing was removed by an administrator');
  await assertValidRefs(input);
  // Existing bookings are unaffected: they store a price snapshot.
  await prisma.$transaction([
    prisma.listingImage.deleteMany({ where: { listingId } }),
    prisma.listingBlockedDate.deleteMany({ where: { listingId } }),
    prisma.listing.update({
      where: { id: listingId },
      data: {
        ...listingData(input),
        images: { create: input.images.map((imageUrl, i) => ({ imageUrl, displayOrder: i })) },
        blockedDates: {
          create: input.blockedDates.map((b) => ({ startDate: parseDateOnly(b.startDate), endDate: parseDateOnly(b.endDate), note: b.note })),
        },
      },
    }),
  ]);
  return { id: listingId };
}

export async function setListingStatus(listingId: string, userId: string, status: 'ACTIVE' | 'PAUSED') {
  const listing = await getOwnedListing(listingId, userId);
  if (listing.status === 'REMOVED') throw ApiError.forbidden('This listing was removed by an administrator');
  return prisma.listing.update({ where: { id: listingId }, data: { status }, select: { id: true, status: true } });
}

export async function deleteListing(listingId: string, userId: string) {
  await getOwnedListing(listingId, userId);
  const upcoming = await prisma.booking.count({
    where: { listingId, status: { in: CONFIRMED_STATUSES } },
  });
  if (upcoming > 0) {
    throw ApiError.conflict('This listing has accepted or active bookings. Complete or cancel them before deleting.');
  }
  // Soft delete: bookings and reviews keep referencing the listing for history.
  await prisma.$transaction([
    prisma.booking.updateMany({
      where: { listingId, status: 'PENDING' },
      data: { status: 'REJECTED', ownerNote: 'Listing was deleted by the owner' },
    }),
    prisma.favorite.deleteMany({ where: { listingId } }),
    prisma.listing.update({ where: { id: listingId }, data: { status: 'DELETED' } }),
  ]);
}

export async function myListings(userId: string) {
  const rows = await prisma.listing.findMany({
    where: { ownerId: userId, status: { not: 'DELETED' } },
    orderBy: { createdAt: 'desc' },
    include: {
      ...cardInclude(todayInMarket()),
      _count: { select: { bookings: true, favorites: true } },
    },
  });
  const pendingCounts = await prisma.booking.groupBy({
    by: ['listingId'],
    where: { ownerId: userId, status: 'PENDING' },
    _count: true,
  });
  const pending = new Map(pendingCounts.map((p) => [p.listingId, p._count]));
  return rows.map((r) => ({
    ...toCard(r, new Set()),
    bookingCount: r._count.bookings,
    favoriteCount: r._count.favorites,
    pendingRequests: pending.get(r.id) ?? 0,
  }));
}

export async function listingsByOwner(ownerId: string, userId?: string) {
  const rows = await prisma.listing.findMany({
    where: { AND: [publicListingWhere, { ownerId }] },
    orderBy: { createdAt: 'desc' },
    include: cardInclude(todayInMarket()),
  });
  return toCards(rows, userId);
}

// ---------------- Favorites ----------------

export async function listFavorites(userId: string) {
  const favs = await prisma.favorite.findMany({
    where: { userId, listing: publicListingWhere },
    orderBy: { createdAt: 'desc' },
    include: { listing: { include: cardInclude(todayInMarket()) } },
  });
  const all = new Set(favs.map((f) => f.listingId));
  return favs.map((f) => toCard(f.listing, all));
}

export async function addFavorite(userId: string, listingId: string) {
  const listing = await prisma.listing.findFirst({ where: { AND: [publicListingWhere, { id: listingId }] }, select: { id: true } });
  if (!listing) throw ApiError.notFound('Listing not found');
  await prisma.favorite.upsert({
    where: { userId_listingId: { userId, listingId } },
    create: { userId, listingId },
    update: {},
  });
}

export async function removeFavorite(userId: string, listingId: string) {
  await prisma.favorite.deleteMany({ where: { userId, listingId } });
}

// ---------------- Reports ----------------

export async function reportListing(reporterId: string, listingId: string, reason: string, description?: string) {
  const listing = await prisma.listing.findUnique({ where: { id: listingId }, select: { ownerId: true, status: true } });
  if (!listing || listing.status === 'DELETED') throw ApiError.notFound('Listing not found');
  if (listing.ownerId === reporterId) throw ApiError.badRequest('You cannot report your own listing');
  const existing = await prisma.report.findFirst({ where: { reporterId, listingId, status: 'OPEN' } });
  if (existing) throw ApiError.conflict('You have already reported this listing. Our team is reviewing it.');
  return prisma.report.create({ data: { reporterId, listingId, reason, description }, select: { id: true } });
}
