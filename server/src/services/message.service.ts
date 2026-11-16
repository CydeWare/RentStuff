import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { notify } from './notification.service.js';

/**
 * Database-backed messaging. Each conversation has exactly two participants.
 * Real-time delivery (e.g. Socket.IO) can be layered on later by emitting an
 * event from sendMessage(); the client currently polls.
 */

async function assertParticipant(conversationId: string, userId: string) {
  const p = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    select: { id: true },
  });
  // 404 so that conversation ids cannot be probed.
  if (!p) throw ApiError.notFound('Conversation not found');
}

export async function listConversations(userId: string) {
  const convs = await prisma.conversation.findMany({
    where: { participants: { some: { userId } } },
    orderBy: { updatedAt: 'desc' },
    include: {
      participants: { include: { user: { select: { id: true, name: true, profileImage: true, city: true } } } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      listing: { select: { id: true, title: true, images: { orderBy: { displayOrder: 'asc' }, take: 1 } } },
    },
  });

  const unreadByConv = await prisma.message.groupBy({
    by: ['conversationId'],
    where: { conversationId: { in: convs.map((c) => c.id) }, senderId: { not: userId }, readAt: null },
    _count: true,
  });
  const unread = new Map(unreadByConv.map((u) => [u.conversationId, u._count]));

  return convs
    .filter((c) => c.messages.length > 0)
    .map((c) => ({
      id: c.id,
      updatedAt: c.updatedAt,
      otherUser: c.participants.find((p) => p.userId !== userId)?.user ?? null,
      lastMessage: c.messages[0] ?? null,
      unreadCount: unread.get(c.id) ?? 0,
      listing: c.listing ? { id: c.listing.id, title: c.listing.title, image: c.listing.images[0]?.imageUrl ?? null } : null,
    }));
}

export async function getConversation(conversationId: string, userId: string) {
  await assertParticipant(conversationId, userId);
  const [conv] = await Promise.all([
    prisma.conversation.findUniqueOrThrow({
      where: { id: conversationId },
      include: {
        participants: { include: { user: { select: { id: true, name: true, profileImage: true, city: true } } } },
        listing: { select: { id: true, title: true, dailyPrice: true, images: { orderBy: { displayOrder: 'asc' }, take: 1 } } },
        messages: { orderBy: { createdAt: 'asc' }, take: 500 },
      },
    }),
    // Opening a conversation marks the other person's messages as read.
    prisma.message.updateMany({
      where: { conversationId, senderId: { not: userId }, readAt: null },
      data: { readAt: new Date() },
    }),
  ]);
  return {
    id: conv.id,
    otherUser: conv.participants.find((p) => p.userId !== userId)?.user ?? null,
    listing: conv.listing
      ? { id: conv.listing.id, title: conv.listing.title, dailyPrice: conv.listing.dailyPrice, image: conv.listing.images[0]?.imageUrl ?? null }
      : null,
    messages: conv.messages,
  };
}

async function createMessage(conversationId: string, senderId: string, content: string) {
  const [message] = await prisma.$transaction([
    prisma.message.create({ data: { conversationId, senderId, content } }),
    prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } }),
  ]);
  const [others, sender] = await Promise.all([
    prisma.conversationParticipant.findMany({ where: { conversationId, userId: { not: senderId } }, select: { userId: true } }),
    prisma.user.findUniqueOrThrow({ where: { id: senderId }, select: { name: true } }),
  ]);
  for (const o of others) {
    // Avoid flooding: one unread "new message" notification per conversation.
    const link = `/dashboard/messages/${conversationId}`;
    const existing = await prisma.notification.findFirst({ where: { userId: o.userId, type: 'NEW_MESSAGE', link, isRead: false } });
    if (!existing) {
      await notify({
        userId: o.userId,
        type: 'NEW_MESSAGE',
        title: `New message from ${sender.name}`,
        message: content.length > 120 ? `${content.slice(0, 117)}...` : content,
        link,
      });
    }
  }
  return message;
}

export async function sendMessage(conversationId: string, senderId: string, content: string) {
  await assertParticipant(conversationId, senderId);
  return createMessage(conversationId, senderId, content);
}

/** Finds the existing 1:1 conversation between two users (optionally about a listing) or creates one. */
export async function startConversation(senderId: string, recipientId: string, content: string, listingId?: string) {
  if (senderId === recipientId) throw ApiError.badRequest('You cannot message yourself');
  const recipient = await prisma.user.findUnique({ where: { id: recipientId }, select: { status: true } });
  if (!recipient || recipient.status !== 'ACTIVE') throw ApiError.notFound('User not found');
  if (listingId) {
    const listing = await prisma.listing.findUnique({ where: { id: listingId }, select: { id: true } });
    if (!listing) throw ApiError.notFound('Listing not found');
  }

  let conv = await prisma.conversation.findFirst({
    where: {
      AND: [{ participants: { some: { userId: senderId } } }, { participants: { some: { userId: recipientId } } }],
    },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, listingId: true },
  });
  if (!conv) {
    conv = await prisma.conversation.create({
      data: { listingId: listingId ?? null, participants: { create: [{ userId: senderId }, { userId: recipientId }] } },
      select: { id: true, listingId: true },
    });
  } else if (listingId && conv.listingId !== listingId) {
    // Keep one thread per pair of users; show the most recent item being discussed.
    await prisma.conversation.update({ where: { id: conv.id }, data: { listingId } });
  }
  await createMessage(conv.id, senderId, content);
  return { conversationId: conv.id };
}

export function unreadMessageCount(userId: string) {
  return prisma.message.count({
    where: { senderId: { not: userId }, readAt: null, conversation: { participants: { some: { userId } } } },
  });
}
