import jwt from 'jsonwebtoken';
import type { Response, CookieOptions } from 'express';
import { env, isProduction } from '../config/env.js';

export const AUTH_COOKIE = 'rentora_token';

interface TokenPayload {
  sub: string;
}

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId } satisfies TokenPayload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    algorithm: 'HS256',
  });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    // Session tokens never carry a purpose claim; this rejects social-login state and signup tokens.
    if (typeof decoded === 'object' && typeof decoded.sub === 'string' && decoded.purpose === undefined) {
      return { sub: decoded.sub };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Short-lived signed tokens used during social login. Each has a `purpose` claim so
 * it can never be accepted as a session token (see verifyToken) or as the other kind.
 */
export function signPurposeToken(purpose: string, claims: Record<string, unknown>, expiresIn: jwt.SignOptions['expiresIn']) {
  return jwt.sign({ ...claims, purpose }, env.JWT_SECRET, { expiresIn, algorithm: 'HS256' });
}

export function verifyPurposeToken(purpose: string, token: string | undefined): Record<string, unknown> | null {
  if (!token) return null;
  try {
    const d = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    return typeof d === 'object' && d.purpose === purpose ? (d as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax',
  path: '/',
};

export function setAuthCookie(res: Response, token: string) {
  res.cookie(AUTH_COOKIE, token, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(AUTH_COOKIE, cookieOptions);
}
