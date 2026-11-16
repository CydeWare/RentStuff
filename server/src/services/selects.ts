import type { Prisma } from '@prisma/client';

/** Fields of a user that anyone may see. Never includes email, phone or password hash. */
export const publicUserSelect = {
  id: true,
  name: true,
  profileImage: true,
  city: true,
  district: true,
  bio: true,
  ratingAvg: true,
  ratingCount: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

/** Fields returned to the account owner. */
export const privateUserSelect = {
  ...publicUserSelect,
  email: true,
  phone: true,
  province: true,
  role: true,
  status: true,
  notifyBookings: true,
  notifyMessages: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export const listingCardInclude = {
  images: { orderBy: { displayOrder: 'asc' }, take: 1 },
  category: { select: { id: true, name: true, slug: true } },
  owner: { select: { id: true, name: true, profileImage: true, ratingAvg: true, ratingCount: true } },
} satisfies Prisma.ListingInclude;
