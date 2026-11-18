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
  // Optional so social-login-only accounts can set a first password; required by the service otherwise.
  currentPassword: z.string().max(128).optional(),
  newPassword: passwordSchema,
});

export const notificationPrefsSchema = z.object({
  notifyBookings: z.boolean(),
  notifyMessages: z.boolean(),
});
