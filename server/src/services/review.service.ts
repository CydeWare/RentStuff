import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { notify } from './notification.service.js';

/** Renter reviews the owner and rental experience for a completed booking. */
export async function createReview(bookingId: string, reviewerId: string, rating: number, comment: string) {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: { review: { select: { id: true } }, renter: { select: { name: true } } },
    });
    if (!booking || booking.renterId !== reviewerId) throw ApiError.notFound('Booking not found');
    if (booking.status !== 'COMPLETED') throw ApiError.forbidden('You can only review completed rentals');
    if (booking.review) throw ApiError.conflict('You have already reviewed this rental');

    const review = await tx.review.create({
      data: {
        bookingId,
        listingId: booking.listingId,
        reviewerId,
        reviewedUserId: booking.ownerId,
        rating,
        comment,
      },
    });

    // Keep denormalized averages (used for sorting and cards) in sync.
    const [ownerAgg, listingAgg] = await Promise.all([
      tx.review.aggregate({ where: { reviewedUserId: booking.ownerId }, _avg: { rating: true }, _count: true }),
      tx.review.aggregate({ where: { listingId: booking.listingId }, _avg: { rating: true }, _count: true }),
    ]);
    await tx.user.update({
      where: { id: booking.ownerId },
      data: { ratingAvg: ownerAgg._avg.rating ?? 0, ratingCount: ownerAgg._count },
    });
    await tx.listing.update({
      where: { id: booking.listingId },
      data: { ratingAvg: listingAgg._avg.rating ?? 0, reviewCount: listingAgg._count },
    });

    await notify(
      {
        userId: booking.ownerId,
        type: 'NEW_REVIEW',
        title: 'New review',
        message: `${booking.renter.name} left a ${rating}-star review for "${booking.listingTitleSnapshot}".`,
        link: `/users/${booking.ownerId}`,
      },
      tx,
    );
    return review;
  });
}

export function reviewsForUser(userId: string, take = 20) {
  return prisma.review.findMany({
    where: { reviewedUserId: userId },
    orderBy: { createdAt: 'desc' },
    take,
    include: {
      reviewer: { select: { id: true, name: true, profileImage: true } },
      listing: { select: { id: true, title: true } },
    },
  });
}
