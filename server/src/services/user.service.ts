import type { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { provinceForCity } from '../config/locations.js';
import { ApiError } from '../utils/ApiError.js';
import { hashPassword, loadMe, verifyPassword } from './auth.service.js';
import { publicUserSelect } from './selects.js';
import type { changePasswordSchema, notificationPrefsSchema, updateProfileSchema } from '../validators/user.validator.js';

async function me(userId: string) {
  const user = await loadMe(userId);
  if (!user) throw ApiError.notFound('User not found');
  return user;
}

export async function updateProfile(userId: string, input: z.infer<typeof updateProfileSchema>) {
  await prisma.user.update({
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
  });
  return me(userId);
}

/** Changes the password, or sets a first password for accounts created with a social login. */
export async function changePassword(userId: string, input: z.infer<typeof changePasswordSchema>) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { passwordHash: true } });
  if (user.passwordHash) {
    if (!input.currentPassword || !(await verifyPassword(input.currentPassword, user.passwordHash))) {
      throw ApiError.badRequest('Current password is incorrect', { fieldErrors: { currentPassword: 'Current password is incorrect' } });
    }
  }
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(input.newPassword) } });
  return me(userId);
}

export async function updateNotificationPrefs(userId: string, input: z.infer<typeof notificationPrefsSchema>) {
  await prisma.user.update({ where: { id: userId }, data: input });
  return me(userId);
}

export async function setAvatar(userId: string, url: string) {
  await prisma.user.update({ where: { id: userId }, data: { profileImage: url } });
  return me(userId);
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
