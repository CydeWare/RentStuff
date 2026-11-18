import type { Request, Response } from 'express';
import * as bookingService from '../services/booking.service.js';
import * as reviewService from '../services/review.service.js';
import { currentUser } from '../middleware/auth.js';
import { parse } from '../utils/validation.js';
import { idParams } from '../validators/common.js';
import { bookingActionSchema, bookingListQuery, createBookingSchema, reviewSchema } from '../validators/booking.validator.js';

export async function create(req: Request, res: Response) {
  const input = parse(createBookingSchema, req.body);
  const booking = await bookingService.createBooking(currentUser(req).id, input);
  res.status(201).json({ booking });
}

export async function list(req: Request, res: Response) {
  const q = parse(bookingListQuery, req.query);
  res.json({ items: await bookingService.listBookings(currentUser(req).id, q.role, q.status) });
}

export async function getOne(req: Request, res: Response) {
  const { id } = parse(idParams, req.params);
  res.json({ booking: await bookingService.getBooking(id, currentUser(req)) });
}

export async function action(req: Request, res: Response) {
  const { id } = parse(idParams, req.params);
  const input = parse(bookingActionSchema, req.body);
  res.json({ booking: await bookingService.applyAction(id, currentUser(req), input.action, input.note) });
}

export async function review(req: Request, res: Response) {
  const { id } = parse(idParams, req.params);
  const input = parse(reviewSchema, req.body);
  const created = await reviewService.createReview(id, currentUser(req).id, input.rating, input.comment);
  res.status(201).json({ review: created });
}

export async function overview(req: Request, res: Response) {
  res.json(await bookingService.dashboardOverview(currentUser(req).id));
}
