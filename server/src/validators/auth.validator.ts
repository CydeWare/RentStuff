import { z } from 'zod';
import { citySchema, imageUrlSchema, phoneSchema, provinceSchema } from './common.js';

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password is too long')
  .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), 'Password must contain letters and numbers');

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  email: z.string().trim().toLowerCase().email('Enter a valid email address').max(254),
  password: passwordSchema,
  phone: phoneSchema,
  city: citySchema,
  province: provinceSchema.optional(),
  district: z.string().trim().max(80).optional(),
  profileImage: imageUrlSchema.optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required').max(128),
});
