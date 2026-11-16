import type { BookingStatus, ListingStatus, Prisma, ReportStatus, UserStatus } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { toDateString } from '../utils/dates.js';
import { notify } from './notification.service.js';

interface ListQuery {
  page: number;
  limit: number;
  q?: string;
  status?: string;
}

function paged<T>(items: T[], total: number, q: ListQuery) {
  return { items, total, page: q.page, limit: q.limit, totalPages: Math.max(1, Math.ceil(total / q.limit)) };
}

export async function stats() {
  const [users, suspended, listingsByStatus, bookingsByStatus, openReports, gmv, newUsers7d] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: 'SUSPENDED' } }),
    prisma.listing.groupBy({ by: ['status'], _count: true }),
    prisma.booking.groupBy({ by: ['status'], _count: true }),
    prisma.report.count({ where: { status: 'OPEN' } }),
    prisma.booking.aggregate({ where: { status: 'COMPLETED' }, _sum: { rentalPriceSnapshot: true, deliveryFeeSnapshot: true } }),
    prisma.user.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * 86_400_000) } } }),
  ]);
  return {
    users,
    suspendedUsers: suspended,
    newUsers7d,
    listings: Object.fromEntries(listingsByStatus.map((l) => [l.status, l._count])),
    bookings: Object.fromEntries(bookingsByStatus.map((b) => [b.status, b._count])),
    openReports,
    completedRentalValue: (gmv._sum.rentalPriceSnapshot ?? 0) + (gmv._sum.deliveryFeeSnapshot ?? 0),
  };
}

export async function listUsers(q: ListQuery) {
  const where: Prisma.UserWhereInput = {
    ...(q.q ? { OR: [{ name: { contains: q.q, mode: 'insensitive' } }, { email: { contains: q.q, mode: 'insensitive' } }] } : {}),
    ...(q.status === 'ACTIVE' || q.status === 'SUSPENDED' ? { status: q.status as UserStatus } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
      select: {
        id: true, name: true, email: true, phone: true, city: true, role: true, status: true, createdAt: true, profileImage: true,
        ratingAvg: true, ratingCount: true,
        _count: { select: { listings: true, rentals: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);
  return paged(items, total, q);
}

export async function setUserStatus(adminId: string, userId: string, status: UserStatus) {
  if (adminId === userId) throw ApiError.badRequest('You cannot change your own account status');
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user) throw ApiError.notFound('User not found');
  if (user.role === 'ADMIN') throw ApiError.forbidden('Administrators cannot be suspended here');
  return prisma.user.update({ where: { id: userId }, data: { status }, select: { id: true, status: true } });
}

export async function listListings(q: ListQuery) {
  const where: Prisma.ListingWhereInput = {
    ...(q.q ? { title: { contains: q.q, mode: 'insensitive' } } : {}),
    ...(q.status && ['ACTIVE', 'PAUSED', 'REMOVED', 'DELETED'].includes(q.status) ? { status: q.status as ListingStatus } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.listing.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
      include: {
        owner: { select: { id: true, name: true, email: true } },
        category: { select: { name: true } },
        images: { orderBy: { displayOrder: 'asc' }, take: 1 },
        _count: { select: { reports: { where: { status: 'OPEN' } }, bookings: true } },
      },
    }),
    prisma.listing.count({ where }),
  ]);
  return paged(items, total, q);
}

export async function setListingStatus(listingId: string, status: 'ACTIVE' | 'REMOVED') {
  const listing = await prisma.listing.findUnique({ where: { id: listingId }, select: { ownerId: true, title: true, status: true } });
  if (!listing || listing.status === 'DELETED') throw ApiError.notFound('Listing not found');
  await prisma.$transaction(async (tx) => {
    await tx.listing.update({ where: { id: listingId }, data: { status } });
    if (status === 'REMOVED') {
      await tx.booking.updateMany({
        where: { listingId, status: 'PENDING' },
        data: { status: 'REJECTED', ownerNote: 'Listing was removed by Rentora' },
      });
      await notify(
        {
          userId: listing.ownerId,
          type: 'SYSTEM',
          title: 'Listing removed',
          message: `"${listing.title}" was removed because it violates our listing guidelines.`,
          link: '/dashboard/listings',
        },
        tx,
      );
    }
  });
  return { id: listingId, status };
}

export async function listBookings(q: ListQuery) {
  const where: Prisma.BookingWhereInput = {
    ...(q.q ? { listingTitleSnapshot: { contains: q.q, mode: 'insensitive' } } : {}),
    ...(q.status && ['PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'ACTIVE', 'COMPLETED'].includes(q.status)
      ? { status: q.status as BookingStatus }
      : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
      include: {
        renter: { select: { id: true, name: true } },
        owner: { select: { id: true, name: true } },
      },
    }),
    prisma.booking.count({ where }),
  ]);
  return paged(
    rows.map((r) => ({ ...r, startDate: toDateString(r.startDate), endDate: toDateString(r.endDate) })),
    total,
    q,
  );
}

export async function listReports(q: ListQuery) {
  const where: Prisma.ReportWhereInput =
    q.status && ['OPEN', 'RESOLVED', 'DISMISSED'].includes(q.status) ? { status: q.status as ReportStatus } : {};
  const [items, total] = await Promise.all([
    prisma.report.findMany({
      where,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      skip: (q.page - 1) * q.limit,
      take: q.limit,
      include: {
        reporter: { select: { id: true, name: true, email: true } },
        listing: { select: { id: true, title: true, status: true, owner: { select: { id: true, name: true } } } },
      },
    }),
    prisma.report.count({ where }),
  ]);
  return paged(items, total, q);
}

export async function updateReport(reportId: string, status: ReportStatus, removeListing?: boolean) {
  const report = await prisma.report.findUnique({ where: { id: reportId } });
  if (!report) throw ApiError.notFound('Report not found');
  if (removeListing) await setListingStatus(report.listingId, 'REMOVED');
  return prisma.report.update({ where: { id: reportId }, data: { status } });
}
