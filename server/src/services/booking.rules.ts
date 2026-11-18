import type { BookingStatus } from '@prisma/client';
import { ApiError } from '../utils/ApiError.js';

/** Bookings in these statuses reserve the item's dates. */
export const CONFIRMED_STATUSES: BookingStatus[] = ['ACCEPTED', 'ACTIVE'];

export type BookingAction = 'accept' | 'reject' | 'cancel' | 'start' | 'complete' | 'simulate_payment';

interface BookingLike {
  status: BookingStatus;
  renterId: string;
  ownerId: string;
  startDate: Date;
  endDate: Date;
  paymentStatus: 'UNPAID' | 'SIMULATED_PAID' | 'SIMULATED_REFUNDED';
}

/**
 * Pure state-machine check for booking status changes. Throws ApiError when the
 * actor may not perform the action; otherwise returns the resulting status.
 *
 *   PENDING  --accept(owner)-->   ACCEPTED --start(owner, on/after start date)--> ACTIVE --complete(owner)--> COMPLETED
 *   PENDING  --reject(owner)-->   REJECTED
 *   PENDING | ACCEPTED --cancel(renter or owner)--> CANCELLED
 */
export function nextStatus(booking: BookingLike, action: BookingAction, actorId: string, today: Date): BookingStatus {
  const isOwner = actorId === booking.ownerId;
  const isRenter = actorId === booking.renterId;
  if (!isOwner && !isRenter) throw ApiError.notFound('Booking not found');

  const fail = (msg: string): never => {
    throw ApiError.conflict(msg);
  };

  switch (action) {
    case 'accept':
      if (!isOwner) throw ApiError.forbidden('Only the owner can accept this request');
      if (booking.status !== 'PENDING') fail(`Cannot accept a booking that is ${booking.status.toLowerCase()}`);
      if (booking.startDate < today) fail('This request has expired because its start date has passed');
      return 'ACCEPTED';
    case 'reject':
      if (!isOwner) throw ApiError.forbidden('Only the owner can reject this request');
      if (booking.status !== 'PENDING') fail(`Cannot reject a booking that is ${booking.status.toLowerCase()}`);
      return 'REJECTED';
    case 'cancel':
      if (booking.status !== 'PENDING' && booking.status !== 'ACCEPTED') {
        fail(`Cannot cancel a booking that is ${booking.status.toLowerCase()}`);
      }
      return 'CANCELLED';
    case 'start':
      if (!isOwner) throw ApiError.forbidden('Only the owner can mark the item as handed over');
      if (booking.status !== 'ACCEPTED') fail('Only accepted bookings can be started');
      if (today < booking.startDate) fail('The rental period has not started yet');
      return 'ACTIVE';
    case 'complete':
      if (!isOwner) throw ApiError.forbidden('Only the owner can confirm the item was returned');
      if (booking.status !== 'ACTIVE') fail('Only active rentals can be completed');
      return 'COMPLETED';
    case 'simulate_payment':
      if (!isRenter) throw ApiError.forbidden('Only the renter can make a payment');
      if (booking.status !== 'ACCEPTED') fail('Payment is only possible after the owner accepts the request');
      if (booking.paymentStatus !== 'UNPAID') fail('This booking is already marked as paid (simulated)');
      return booking.status;
  }
}
