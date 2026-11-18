import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { AUTH_COOKIE, clearAuthCookie, verifyToken } from '../utils/auth.js';

async function resolveUser(req: Request, res: Response) {
  const token: string | undefined = req.cookies?.[AUTH_COOKIE];
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) {
    clearAuthCookie(res);
    return null;
  }
  // Always re-read the user so role changes and suspensions take effect immediately.
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, role: true, name: true, status: true },
  });
  if (!user || user.status !== 'ACTIVE') {
    clearAuthCookie(res);
    return null;
  }
  return { id: user.id, role: user.role, name: user.name };
}

/** Attaches req.user when a valid session exists, but never blocks the request. */
export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  req.user = (await resolveUser(req, res)) ?? undefined;
  next();
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = await resolveUser(req, res);
  if (!user) throw ApiError.unauthorized();
  req.user = user;
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = await resolveUser(req, res);
  if (!user) throw ApiError.unauthorized();
  if (user.role !== 'ADMIN') throw ApiError.forbidden('Admin access only');
  req.user = user;
  next();
}

/** Use inside handlers behind requireAuth. */
export function currentUser(req: Request): Express.AuthUser {
  if (!req.user) throw ApiError.unauthorized();
  return req.user;
}
