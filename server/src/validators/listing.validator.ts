import { z } from 'zod';
import { citySchema, dateString, imageUrlSchema, pageQuery, provinceSchema, rupiah } from './common.js';
import { parseDateOnly } from '../utils/dates.js';

export const CONDITIONS = ['BRAND_NEW', 'LIKE_NEW', 'GOOD', 'FAIR'] as const;

const blockedRange = z
  .object({ startDate: dateString, endDate: dateString, note: z.string().trim().max(120).optional() })
  .refine((r) => parseDateOnly(r.endDate) >= parseDateOnly(r.startDate), 'End date must be on or after start date');

const optionalPrice = (label: string) =>
  z.preprocess((v) => (v === '' || v === undefined ? null : v), rupiah(label).min(1, `${label} must be positive`).nullable());

export const listingInputSchema = z
  .object({
    title: z.string().trim().min(5, 'Title must be at least 5 characters').max(100),
    description: z.string().trim().min(20, 'Description must be at least 20 characters').max(4000),
    categoryId: z.string().min(1, 'Category is required'),
    subcategory: z.string().trim().max(60).optional().nullable(),
    dailyPrice: rupiah('Daily price').min(1000, 'Daily price must be at least Rp1.000'),
    weeklyPrice: optionalPrice('Weekly price'),
    monthlyPrice: optionalPrice('Monthly price'),
    securityDeposit: rupiah('Security deposit'),
    condition: z.enum(CONDITIONS, { errorMap: () => ({ message: 'Choose an item condition' }) }),
    province: provinceSchema,
    city: citySchema,
    district: z.string().trim().max(80).optional().nullable(),
    address: z.string().trim().min(5, 'Describe the pickup location').max(300),
    pickupAvailable: z.boolean(),
    deliveryAvailable: z.boolean(),
    deliveryFee: rupiah('Delivery fee').default(0),
    minRentalDays: z.coerce.number().int().min(1).max(365).default(1),
    maxRentalDays: z.preprocess((v) => (v === '' || v === undefined ? null : v), z.coerce.number().int().min(1).max(365).nullable()),
    images: z.array(imageUrlSchema).min(1, 'Add at least one photo').max(10, 'Up to 10 photos'),
    blockedDates: z.array(blockedRange).max(50).default([]),
  })
  .superRefine((v, ctx) => {
    if (!v.pickupAvailable && !v.deliveryAvailable) {
      ctx.addIssue({ code: 'custom', path: ['pickupAvailable'], message: 'Offer pickup, delivery, or both' });
    }
    if (v.maxRentalDays != null && v.maxRentalDays < v.minRentalDays) {
      ctx.addIssue({ code: 'custom', path: ['maxRentalDays'], message: 'Maximum must be at least the minimum rental period' });
    }
    if (v.weeklyPrice != null && v.weeklyPrice >= v.dailyPrice * 7) {
      ctx.addIssue({ code: 'custom', path: ['weeklyPrice'], message: 'Weekly price should be lower than 7 × daily price' });
    }
    if (v.monthlyPrice != null && v.monthlyPrice >= v.dailyPrice * 30) {
      ctx.addIssue({ code: 'custom', path: ['monthlyPrice'], message: 'Monthly price should be lower than 30 × daily price' });
    }
  });

export type ListingInput = z.infer<typeof listingInputSchema>;

export const listingStatusSchema = z.object({ status: z.enum(['ACTIVE', 'PAUSED']) });

export const SORTS = ['relevance', 'price_asc', 'price_desc', 'rating', 'newest'] as const;

const optionalNumber = z.preprocess((v) => (v === '' ? undefined : v), z.coerce.number().int().min(0).optional());

export const searchQuerySchema = pageQuery
  .extend({
    q: z.string().trim().max(100).optional(),
    category: z.string().trim().max(60).optional(), // slug
    city: z.string().trim().max(60).optional(),
    district: z.string().trim().max(80).optional(),
    minPrice: optionalNumber,
    maxPrice: optionalNumber,
    condition: z
      .string()
      .optional()
      .transform((v) => (v ? v.split(',').filter(Boolean) : []))
      .pipe(z.array(z.enum(CONDITIONS))),
    startDate: dateString.optional(),
    endDate: dateString.optional(),
    duration: z.preprocess((v) => (v === '' ? undefined : v), z.coerce.number().int().min(1).max(365).optional()),
    delivery: z.enum(['true', 'false']).optional(),
    sort: z.enum(SORTS).default('relevance'),
  })
  .refine((v) => v.minPrice == null || v.maxPrice == null || v.minPrice <= v.maxPrice, {
    message: 'Minimum price cannot exceed maximum price',
    path: ['minPrice'],
  });

export type SearchQuery = z.infer<typeof searchQuerySchema>;

export const featuredQuerySchema = z.object({
  type: z.enum(['popular', 'recent', 'recommended']).default('recommended'),
  city: z.string().trim().max(60).optional(),
  limit: z.coerce.number().int().min(1).max(24).default(8),
});

export const reportSchema = z.object({
  reason: z.enum(['PROHIBITED_ITEM', 'MISLEADING', 'SCAM', 'OFFENSIVE', 'DUPLICATE', 'OTHER']),
  description: z.string().trim().max(1000).optional(),
});
