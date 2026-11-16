import type { Request, Response } from 'express';
import { LOCATIONS } from '../config/locations.js';
import { cloudinaryEnabled } from '../config/env.js';
import * as listingService from '../services/listing.service.js';
import * as messageService from '../services/message.service.js';
import * as notificationService from '../services/notification.service.js';
import { storeImage } from '../services/storage.service.js';
import { currentUser } from '../middleware/auth.js';
import { ApiError } from '../utils/ApiError.js';
import { parse } from '../utils/validation.js';
import { idParams, pageQuery } from '../validators/common.js';
import { sendMessageSchema, startConversationSchema } from '../validators/message.validator.js';

// ---- Meta ----
export async function categories(_req: Request, res: Response) {
  res.json({ items: await listingService.categoriesWithCounts() });
}

export function locations(_req: Request, res: Response) {
  res.json({ items: LOCATIONS });
}

export function config(_req: Request, res: Response) {
  res.json({ imageStorage: cloudinaryEnabled ? 'cloudinary' : 'local', maps: false, payments: 'simulated' });
}

// ---- Uploads ----
export async function uploadImages(req: Request, res: Response) {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (files.length === 0) throw ApiError.badRequest('Choose at least one image');
  const urls = await Promise.all(files.map((f) => storeImage(f, 'listings')));
  res.status(201).json({ urls });
}

// ---- Messages ----
export async function conversations(req: Request, res: Response) {
  res.json({ items: await messageService.listConversations(currentUser(req).id) });
}

export async function conversation(req: Request, res: Response) {
  const { id } = parse(idParams, req.params);
  res.json({ conversation: await messageService.getConversation(id, currentUser(req).id) });
}

export async function startConversation(req: Request, res: Response) {
  const input = parse(startConversationSchema, req.body);
  res.status(201).json(await messageService.startConversation(currentUser(req).id, input.recipientId, input.content, input.listingId));
}

export async function sendMessage(req: Request, res: Response) {
  const { id } = parse(idParams, req.params);
  const { content } = parse(sendMessageSchema, req.body);
  res.status(201).json({ message: await messageService.sendMessage(id, currentUser(req).id, content) });
}

// ---- Notifications ----
export async function notifications(req: Request, res: Response) {
  const q = parse(pageQuery, req.query);
  res.json(await notificationService.listNotifications(currentUser(req).id, q.page, q.limit));
}

export async function markNotificationRead(req: Request, res: Response) {
  const { id } = parse(idParams, req.params);
  const ok = await notificationService.markRead(currentUser(req).id, id);
  if (!ok) throw ApiError.notFound('Notification not found');
  res.json({ ok: true });
}

export async function markAllNotificationsRead(req: Request, res: Response) {
  await notificationService.markAllRead(currentUser(req).id);
  res.json({ ok: true });
}

/** Badge counts for the navigation bar, fetched in one request. */
export async function counts(req: Request, res: Response) {
  const userId = currentUser(req).id;
  const [notificationsUnread, messagesUnread] = await Promise.all([
    notificationService.unreadCount(userId),
    messageService.unreadMessageCount(userId),
  ]);
  res.json({ notifications: notificationsUnread, messages: messagesUnread });
}
