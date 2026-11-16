import rateLimit from 'express-rate-limit';
import { isTest } from '../config/env.js';

const common = {
  standardHeaders: 'draft-7' as const,
  legacyHeaders: false,
  skip: () => isTest,
  message: { error: { message: 'Too many requests, please try again later', code: 'RATE_LIMITED' } },
};

/** Login / registration: protects against credential stuffing. */
export const authLimiter = rateLimit({ ...common, windowMs: 15 * 60 * 1000, limit: 20 });

/** Writes such as bookings, messages, reports and uploads. */
export const sensitiveLimiter = rateLimit({ ...common, windowMs: 60 * 1000, limit: 30 });

/** Generic API protection. */
export const apiLimiter = rateLimit({ ...common, windowMs: 60 * 1000, limit: 300 });
