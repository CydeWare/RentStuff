import { z } from 'zod';
import { ALL_CITIES, LOCATIONS } from '../config/locations.js';
import { isAllowedImageUrl } from '../services/storage.service.js';
import { isValidDateString } from '../utils/dates.js';

export const idSchema = z.string().min(1).max(64).regex(/^[a-z0-9]+$/i, 'Invalid id');
export const idParams = z.object({ id: idSchema });

export const dateString = z.string().refine(isValidDateString, 'Must be a valid date (YYYY-MM-DD)');

export const citySchema = z.string().refine((c) => ALL_CITIES.includes(c), 'Please choose a supported city');
export const provinceSchema = z
  .string()
  .refine((p) => LOCATIONS.some((l) => l.name === p), 'Please choose a supported province');

export const imageUrlSchema = z.string().max(500).refine(isAllowedImageUrl, 'Image URL is not allowed');

/** Indonesian mobile numbers: 08xx, 628xx or +628xx, 9-15 digits total. */
export const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ''))
  .refine((v) => /^(\+62|62|0)8\d{7,12}$/.test(v), 'Enter a valid Indonesian phone number, e.g. 0812xxxxxxxx');

export const pageQuery = z.object({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

export const rupiah = (label: string) =>
  z.coerce
    .number({ invalid_type_error: `${label} must be a number` })
    .int(`${label} must be a whole number`)
    .min(0, `${label} cannot be negative`)
    .max(1_000_000_000, `${label} is too large`);
