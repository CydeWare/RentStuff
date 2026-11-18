import type { Request, Response } from 'express';
import * as userService from '../services/user.service.js';
import * as listingService from '../services/listing.service.js';
import * as reviewService from '../services/review.service.js';
import { storeImage } from '../services/storage.service.js';
import { currentUser } from '../middleware/auth.js';
import { ApiError } from '../utils/ApiError.js';
import { parse } from '../utils/validation.js';
import { idParams } from '../validators/common.js';
import { changePasswordSchema, notificationPrefsSchema, updateProfileSchema } from '../validators/user.validator.js';

export async function updateProfile(req: Request, res: Response) {
  const input = parse(updateProfileSchema, req.body);
  res.json({ user: await userService.updateProfile(currentUser(req).id, input) });
}

export async function changePassword(req: Request, res: Response) {
  const input = parse(changePasswordSchema, req.body);
  res.json({ ok: true, user: await userService.changePassword(currentUser(req).id, input) });
}

export async function updatePrefs(req: Request, res: Response) {
  const input = parse(notificationPrefsSchema, req.body);
  res.json({ user: await userService.updateNotificationPrefs(currentUser(req).id, input) });
}

export async function uploadAvatar(req: Request, res: Response) {
  if (!req.file) throw ApiError.badRequest('Choose an image to upload');
  const url = await storeImage(req.file, 'avatars');
  res.json({ user: await userService.setAvatar(currentUser(req).id, url) });
}

export async function publicProfile(req: Request, res: Response) {
  const { id } = parse(idParams, req.params);
  const [user, listings, reviews] = await Promise.all([
    userService.publicProfile(id),
    listingService.listingsByOwner(id, req.user?.id),
    reviewService.reviewsForUser(id),
  ]);
  res.json({ user, listings, reviews });
}
