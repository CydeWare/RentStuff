import { z } from 'zod';
import { passwordSchema } from './auth.validator.js';
import { citySchema, imageUrlSchema, phoneSchema, provinceSchema } from './common.js';

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: phoneSchema,
  city: citySchema,
  province: provinceSchema.optional().nullable(),
  district: z.string().trim().max(80).optional().nullable(),
  bio: z.string().trim().max(500).optional().nullable(),
  profileImage: imageUrlSchema.optional().nullable(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
});

export const notificationPrefsSchema = z.object({
  notifyBookings: z.boolean(),
  notifyMessages: z.boolean(),
});
