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

/**
 * The current user's own account as returned to the client. Adds login-method flags
 * without ever exposing the password hash or provider ids.
 */
export async function loadMe(userId: string) {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { ...privateUserSelect, passwordHash: true, oauthAccounts: { select: { provider: true }, orderBy: { createdAt: 'asc' } } },
  });
  if (!row) return null;
  const { passwordHash, oauthAccounts, ...user } = row;
  return { ...user, hasPassword: passwordHash !== null, connectedProviders: oauthAccounts.map((a) => a.provider) };
}

export async function loadMeOrThrow(userId: string) {
  const me = await loadMe(userId);
  if (!me) throw ApiError.notFound('User not found');
  return me;
}

export async function register(input: z.infer<typeof registerSchema>) {
  const existing = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (existing) throw ApiError.conflict('An account with this email already exists');

  const user = await prisma.user.create({
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
    select: { id: true },
  });
  return loadMeOrThrow(user.id);
}

export async function login(input: z.infer<typeof loginSchema>) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  // Social-only accounts have no password hash, so they fail here with the same timing and message.
  const ok = await verifyPassword(input.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !user.passwordHash || !ok) throw ApiError.unauthorized('Incorrect email or password');
  if (user.status === 'SUSPENDED') throw ApiError.forbidden('This account has been suspended. Please contact support.');
  return loadMeOrThrow(user.id);
}

export const getMe = loadMe;
