import type { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { provinceForCity } from '../config/locations.js';
import { ApiError } from '../utils/ApiError.js';
import { hashPassword, verifyPassword } from './auth.service.js';
import { privateUserSelect, publicUserSelect } from './selects.js';
import type { changePasswordSchema, notificationPrefsSchema, updateProfileSchema } from '../validators/user.validator.js';

export async function updateProfile(userId: string, input: z.infer<typeof updateProfileSchema>) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      name: input.name,
      phone: input.phone,
      city: input.city,
      province: input.province ?? provinceForCity(input.city) ?? null,
      district: input.district ?? null,
      bio: input.bio ?? null,
      ...(input.profileImage !== undefined ? { profileImage: input.profileImage } : {}),
    },
    select: privateUserSelect,
  });
}

export async function changePassword(userId: string, input: z.infer<typeof changePasswordSchema>) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { passwordHash: true } });
  if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
    throw ApiError.badRequest('Current password is incorrect', { fieldErrors: { currentPassword: 'Current password is incorrect' } });
  }
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(input.newPassword) } });
}

export function updateNotificationPrefs(userId: string, input: z.infer<typeof notificationPrefsSchema>) {
  return prisma.user.update({ where: { id: userId }, data: input, select: privateUserSelect });
}

export async function setAvatar(userId: string, url: string) {
  return prisma.user.update({ where: { id: userId }, data: { profileImage: url }, select: privateUserSelect });
}

/** Public profile: never exposes email or phone. */
export async function publicProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { ...publicUserSelect, status: true, _count: { select: { ownedBookings: { where: { status: 'COMPLETED' } } } } },
  });
  if (!user || user.status !== 'ACTIVE') throw ApiError.notFound('User not found');
  const { status, _count, ...rest } = user;
  void status;
  return { ...rest, completedRentals: _count.ownedBookings };
}
