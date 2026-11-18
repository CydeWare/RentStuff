import type { Request, Response } from 'express';
import * as adminService from '../services/admin.service.js';
import { currentUser } from '../middleware/auth.js';
import { parse } from '../utils/validation.js';
import { idParams } from '../validators/common.js';
import { adminListingStatusSchema, adminListQuery, reportStatusSchema, userStatusSchema } from '../validators/admin.validator.js';

export async function stats(_req: Request, res: Response) {
  res.json(await adminService.stats());
}

export async function users(req: Request, res: Response) {
  res.json(await adminService.listUsers(parse(adminListQuery, req.query)));
}

export async function setUserStatus(req: Request, res: Response) {
  const { id } = parse(idParams, req.params);
  const { status } = parse(userStatusSchema, req.body);
  res.json({ user: await adminService.setUserStatus(currentUser(req).id, id, status) });
}

export async function listings(req: Request, res: Response) {
  res.json(await adminService.listListings(parse(adminListQuery, req.query)));
}

export async function setListingStatus(req: Request, res: Response) {
  const { id } = parse(idParams, req.params);
  const { status } = parse(adminListingStatusSchema, req.body);
  res.json({ listing: await adminService.setListingStatus(id, status) });
}

export async function bookings(req: Request, res: Response) {
  res.json(await adminService.listBookings(parse(adminListQuery, req.query)));
}

export async function reports(req: Request, res: Response) {
  res.json(await adminService.listReports(parse(adminListQuery, req.query)));
}

export async function updateReport(req: Request, res: Response) {
  const { id } = parse(idParams, req.params);
  const input = parse(reportStatusSchema, req.body);
  res.json({ report: await adminService.updateReport(id, input.status, input.removeListing) });
}
