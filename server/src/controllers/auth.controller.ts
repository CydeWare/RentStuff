import type { Request, Response } from 'express';
import * as authService from '../services/auth.service.js';
import { currentUser } from '../middleware/auth.js';
import { clearAuthCookie, setAuthCookie, signToken } from '../utils/auth.js';
import { parse } from '../utils/validation.js';
import { loginSchema, registerSchema } from '../validators/auth.validator.js';

export async function register(req: Request, res: Response) {
  const input = parse(registerSchema, req.body);
  const user = await authService.register(input);
  setAuthCookie(res, signToken(user.id));
  res.status(201).json({ user });
}

export async function login(req: Request, res: Response) {
  const input = parse(loginSchema, req.body);
  const user = await authService.login(input);
  setAuthCookie(res, signToken(user.id));
  res.json({ user });
}

export function logout(_req: Request, res: Response) {
  clearAuthCookie(res);
  res.json({ ok: true });
}

export async function me(req: Request, res: Response) {
  // Behind optionalAuth: returns { user: null } for guests instead of a 401.
  if (!req.user) {
    res.json({ user: null });
    return;
  }
  res.json({ user: await authService.getMe(currentUser(req).id) });
}
