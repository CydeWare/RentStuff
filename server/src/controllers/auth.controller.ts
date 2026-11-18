import type { CookieOptions, Request, Response } from 'express';
import * as authService from '../services/auth.service.js';
import * as oauth from '../services/oauth.service.js';
import { currentUser } from '../middleware/auth.js';
import { isProduction } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { clearAuthCookie, setAuthCookie, signToken } from '../utils/auth.js';
import { parse } from '../utils/validation.js';
import { loginSchema, oauthCompleteSchema, registerSchema } from '../validators/auth.validator.js';

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

// ---------------- Social login ----------------

// Lax cookies are still sent on the top-level redirect back from the provider.
const oauthCookie: CookieOptions = { httpOnly: true, secure: isProduction, sameSite: 'lax', path: '/api/auth/oauth' };

function withParams(path: string, params: Record<string, string>) {
  const url = new URL(path, 'http://app.local');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.pathname + url.search + url.hash;
}

/** Full-page navigation target of the "Continue with ..." buttons. */
export function oauthStart(req: Request, res: Response) {
  const provider = String(req.params.provider);
  const connect = req.query.mode === 'connect';
  if (connect && !req.user) {
    res.redirect(withParams('/login', { redirect: '/dashboard/settings' }));
    return;
  }
  try {
    const { url, stateToken } = oauth.startLogin(provider, {
      redirect: typeof req.query.redirect === 'string' ? req.query.redirect : undefined,
      connectUserId: connect ? req.user!.id : undefined,
    });
    res.cookie(oauth.STATE_COOKIE, stateToken, { ...oauthCookie, maxAge: 10 * 60 * 1000 });
    res.redirect(url);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      res.redirect(withParams(connect ? '/dashboard/settings' : '/login', { oauthError: 'unavailable' }));
      return;
    }
    throw e;
  }
}

export async function oauthCallback(req: Request, res: Response) {
  const provider = String(req.params.provider);
  const outcome = await oauth.handleCallback(provider, req.query, req.cookies?.[oauth.STATE_COOKIE], req.user?.id);
  res.clearCookie(oauth.STATE_COOKIE, oauthCookie); // state is single use

  switch (outcome.kind) {
    case 'signed_in':
      setAuthCookie(res, signToken(outcome.userId));
      res.redirect(outcome.redirect);
      return;
    case 'connected':
      res.redirect(withParams(outcome.redirect, { connected: provider }));
      return;
    case 'needs_profile':
      res.cookie(oauth.SIGNUP_COOKIE, outcome.signupToken, { ...oauthCookie, maxAge: 15 * 60 * 1000 });
      res.redirect('/complete-signup');
      return;
    case 'error':
      res.redirect(withParams(outcome.redirect, { oauthError: outcome.code, provider }));
  }
}

/** Profile from the provider, shown on the "finish signing up" page. */
export function oauthPendingSignup(req: Request, res: Response) {
  // { pending: null } (not a 404) when there is no sign-up in progress or it expired.
  const pending = oauth.readPendingSignup(req.cookies?.[oauth.SIGNUP_COOKIE]);
  res.json({ pending: pending ? oauth.pendingSignupView(pending) : null });
}

export async function oauthComplete(req: Request, res: Response) {
  const input = parse(oauthCompleteSchema, req.body);
  const { user, redirect } = await oauth.completeSignup(req.cookies?.[oauth.SIGNUP_COOKIE], input);
  res.clearCookie(oauth.SIGNUP_COOKIE, oauthCookie);
  setAuthCookie(res, signToken(user.id));
  res.status(201).json({ user, redirect });
}

export async function oauthDisconnect(req: Request, res: Response) {
  res.json({ user: await oauth.disconnect(currentUser(req).id, String(req.params.provider)) });
}
