import rateLimit from 'express-rate-limit';
import { isProduction, isTest } from '../config/env.js';

/**
 * Limits are tuned for production. In development everything comes from one IP
 * (localhost) while you click around and retry, so limits are 10x higher there.
 */
const scale = (n: number) => (isProduction ? n : n * 10);

const common = {
  standardHeaders: 'draft-7' as const,
  legacyHeaders: false,
  skip: () => isTest,
  message: { error: { message: 'Too many requests, please try again later', code: 'RATE_LIMITED' } },
};

/** Password login / registration / password changes: protects against credential stuffing. */
export const authLimiter = rateLimit({ ...common, windowMs: 15 * 60 * 1000, limit: scale(20) });

/**
 * Social login redirects (start + callback). Kept separate from authLimiter so
 * normal Google/Facebook logins don't use up the password-login budget, and it
 * answers with a redirect because these are full-page browser navigations.
 */
export const oauthLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  limit: scale(60),
  handler: (_req, res) => {
    res.redirect('/login?oauthError=rate_limited');
  },
});

/** Writes such as bookings, messages, reports and uploads. */
export const sensitiveLimiter = rateLimit({ ...common, windowMs: 60 * 1000, limit: scale(30) });

/** Generic API protection. */
export const apiLimiter = rateLimit({ ...common, windowMs: 60 * 1000, limit: scale(300) });
