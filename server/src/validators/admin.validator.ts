import { z } from 'zod';
import { pageQuery } from './common.js';

export const adminListQuery = pageQuery.extend({
  q: z.string().trim().max(100).optional(),
  status: z.string().trim().max(20).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const userStatusSchema = z.object({ status: z.enum(['ACTIVE', 'SUSPENDED']) });
export const adminListingStatusSchema = z.object({ status: z.enum(['ACTIVE', 'REMOVED']) });
export const reportStatusSchema = z.object({
  status: z.enum(['OPEN', 'RESOLVED', 'DISMISSED']),
  removeListing: z.boolean().optional(),
});
