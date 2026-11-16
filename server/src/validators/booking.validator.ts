import { z } from 'zod';
import { dateString, idSchema } from './common.js';

export const quoteSchema = z.object({
  startDate: dateString,
  endDate: dateString,
  fulfillmentMethod: z.enum(['PICKUP', 'DELIVERY']).default('PICKUP'),
});

export const createBookingSchema = quoteSchema.extend({
  listingId: idSchema,
  note: z.string().trim().max(500).optional(),
});

export const bookingActionSchema = z.object({
  action: z.enum(['accept', 'reject', 'cancel', 'start', 'complete', 'simulate_payment']),
  note: z.string().trim().max(500).optional(),
});

export const bookingListQuery = z.object({
  role: z.enum(['renter', 'owner']).default('renter'),
  status: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').filter(Boolean) : []))
    .pipe(z.array(z.enum(['PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'ACTIVE', 'COMPLETED']))),
});

export const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1, 'Choose a rating').max(5),
  comment: z.string().trim().min(10, 'Review must be at least 10 characters').max(1000),
});
