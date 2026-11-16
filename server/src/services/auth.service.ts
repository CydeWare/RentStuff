import bcrypt from 'bcryptjs';
import type { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { provinceForCity } from '../config/locations.js';
import { ApiError } from '../utils/ApiError.js';
import { privateUserSelect } from './selects.js';
import type { loginSchema, registerSchema } from '../validators/auth.validator.js';

const BCRYPT_ROUNDS = 12;
// Used to keep login timing similar whether or not the email exists.
const DUMMY_HASH = bcrypt.hashSync('timing-safe-dummy-password', BCRYPT_ROUNDS);

export function hashPassword(password: string) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function register(input: z.infer<typeof registerSchema>) {
  const existing = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (existing) throw ApiError.conflict('An account with this email already exists');

  return prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      phone: input.phone,
      city: input.city,
      province: input.province ?? provinceForCity(input.city),
      district: input.district || null,
      profileImage: input.profileImage ?? null,
    },
    select: privateUserSelect,
  });
}

export async function login(input: z.infer<typeof loginSchema>) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  const ok = await verifyPassword(input.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) throw ApiError.unauthorized('Incorrect email or password');
  if (user.status === 'SUSPENDED') {
    throw ApiError.forbidden('This account has been suspended. Please contact support.');
  }
  return prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: privateUserSelect });
}

export function getMe(userId: string) {
  return prisma.user.findUnique({ where: { id: userId }, select: privateUserSelect });
}
