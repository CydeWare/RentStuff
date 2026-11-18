import type { Request, Response } from 'express';
import * as listingService from '../services/listing.service.js';
import * as bookingService from '../services/booking.service.js';
import { currentUser } from '../middleware/auth.js';
import { parse } from '../utils/validation.js';
import { idParams } from '../validators/common.js';
import { quoteSchema } from '../validators/booking.validator.js';
import {
  featuredQuerySchema,
  listingInputSchema,
  listingStatusSchema,
  reportSchema,
  searchQuerySchema,
} from '../validators/listing.validator.js';

export async function search(req: Request, res: Response) {
  const query = parse(searchQuerySchema, req.query);
  res.json(await listingService.searchListings(query, req.user?.id));
}

export async function featured(req: Request, res: Response) {
  const q = parse(featuredQuerySchema, req.query);
  res.json({ items: await listingService.featuredListings(q.type, q.limit, q.city, req.user?.id) });
}

export async function getOne(req: Request, res: Response) {
  const { id } = parse(idParams, req.params);
  res.json({ listing: await listingService.getListing(id, req.user) });
}

export async function quote(req: Request, res: Response) {
  const { id } = parse(idParams, req.params);
  const input = parse(quoteSchema, req.query);
  res.json(await bookingService.quote(id, input, req.user?.id));
}

export async function create(req: Request, res: Response) {
  const input = parse(listingInputSchema, req.body);
  const listing = await listingService.createListing(currentUser(req).id, input);
  res.status(201).json({ listing });
}

export async function update(req: Request, res: Response) {
  const { id } = parse(idParams, req.params);
  const input = parse(listingInputSchema, req.body);
  res.json({ listing: await listingService.updateListing(id, currentUser(req).id, input) });
}

export async function setStatus(req: Request, res: Response) {
  const { id } = parse(idParams, req.params);
  const { status } = parse(listingStatusSchema, req.body);
  res.json({ listing: await listingService.setListingStatus(id, currentUser(req).id, status) });
}

export async function remove(req: Request, res: Response) {
  const { id } = parse(idParams, req.params);
  await listingService.deleteListing(id, currentUser(req).id);
  res.status(204).end();
}

export async function mine(req: Request, res: Response) {
  res.json({ items: await listingService.myListings(currentUser(req).id) });
}

export async function report(req: Request, res: Response) {
  const { id } = parse(idParams, req.params);
  const input = parse(reportSchema, req.body);
  await listingService.reportListing(currentUser(req).id, id, input.reason, input.description);
  res.status(201).json({ ok: true });
}

export async function favorite(req: Request, res: Response) {
  const { id } = parse(idParams, req.params);
  await listingService.addFavorite(currentUser(req).id, id);
  res.status(201).json({ isFavorited: true });
}

export async function unfavorite(req: Request, res: Response) {
  const { id } = parse(idParams, req.params);
  await listingService.removeFavorite(currentUser(req).id, id);
  res.json({ isFavorited: false });
}

export async function favorites(req: Request, res: Response) {
  res.json({ items: await listingService.listFavorites(currentUser(req).id) });
}
