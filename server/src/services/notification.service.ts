import type { NotificationType, Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../config/prisma.js';

type Db = PrismaClient | Prisma.TransactionClient;

interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}

const BOOKING_TYPES: NotificationType[] = [
  'BOOKING_REQUEST',
  'BOOKING_ACCEPTED',
  'BOOKING_REJECTED',
  'BOOKING_CANCELLED',
  'BOOKING_ACTIVE',
  'BOOKING_COMPLETED',
];

/** Creates an in-app notification, respecting the user's notification preferences. */
export async function notify(input: NotifyInput, db: Db = prisma) {
  const user = await db.user.findUnique({
    where: { id: input.userId },
    select: { notifyBookings: true, notifyMessages: true },
  });
  if (!user) return;
  if (BOOKING_TYPES.includes(input.type) && !user.notifyBookings) return;
  if (input.type === 'NEW_MESSAGE' && !user.notifyMessages) return;
  await db.notification.create({ data: input });
}

export async function listNotifications(userId: string, page: number, limit: number) {
  const [items, total, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.notification.count({ where: { userId } }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);
  return { items, total, unread, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export function unreadCount(userId: string) {
  return prisma.notification.count({ where: { userId, isRead: false } });
}

export async function markRead(userId: string, id: string) {
  // Scoped by userId so users cannot touch other users' notifications.
  const res = await prisma.notification.updateMany({ where: { id, userId }, data: { isRead: true } });
  return res.count > 0;
}

export function markAllRead(userId: string) {
  return prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
}
