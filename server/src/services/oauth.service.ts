/**
 * Social login flow (Google, Facebook, GitHub, ...).
 *
 *   1. GET  /api/auth/oauth/:provider/start     -> redirect to the provider (state + PKCE in a signed cookie)
 *   2. GET  /api/auth/oauth/:provider/callback  -> verify state, exchange code, then one of:
 *        - account already connected   -> sign in, back to the app
 *        - "connect" mode (logged in)  -> connect to current user, back to settings
 *        - new email                   -> signed "pending signup" cookie, go to /complete-signup
 *   3. POST /api/auth/oauth/complete            -> create the account with phone + city
 *
 * Existing email/password accounts are NOT linked automatically. Rentora does not
 * verify emails at registration, so auto-linking would let someone who pre-registered
 * a victim's email keep access after the victim signs in with a provider. Users link
 * providers from Account settings while logged in instead.
 */
import { createHash, randomBytes } from 'node:crypto';
import type { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { appUrl } from '../config/env.js';
import { provinceForCity } from '../config/locations.js';
import { ApiError } from '../utils/ApiError.js';
import { signPurposeToken, verifyPurposeToken } from '../utils/auth.js';
import { loadMeOrThrow } from './auth.service.js';
import { buildAuthorizeUrl, exchangeCodeForProfile, getProvider, providerLabel, type OAuthProfile } from './oauth.providers.js';
import type { oauthCompleteSchema } from '../validators/auth.validator.js';

export const STATE_COOKIE = 'rentora_oauth_state';
export const SIGNUP_COOKIE = 'rentora_oauth_signup';
const STATE_PURPOSE = 'oauth_state';
const SIGNUP_PURPOSE = 'oauth_signup';

export function redirectUriFor(provider: string) {
  return `${appUrl}/api/auth/oauth/${provider}/callback`;
}

/** Only same-site relative paths, to prevent open redirects. */
export function safeRedirectPath(value: unknown, fallback = '/dashboard') {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\') || value.length > 500) {
    return fallback;
  }
  return value;
}

const base64url = (b: Buffer) => b.toString('base64url');

export function startLogin(providerKey: string, opts: { redirect?: string; connectUserId?: string }) {
  const provider = getProvider(providerKey);
  if (!provider) throw ApiError.notFound('This login method is not available');
  const state = base64url(randomBytes(24));
  const codeVerifier = provider.pkce ? base64url(randomBytes(32)) : undefined;
  const codeChallenge = codeVerifier ? base64url(createHash('sha256').update(codeVerifier).digest()) : undefined;

  const stateToken = signPurposeToken(
    STATE_PURPOSE,
    {
      provider: providerKey,
      state,
      codeVerifier,
      redirect: safeRedirectPath(opts.redirect, opts.connectUserId ? '/dashboard/settings' : '/dashboard'),
      connectUserId: opts.connectUserId,
    },
    '10m',
  );
  const url = buildAuthorizeUrl(provider, { redirectUri: redirectUriFor(providerKey), state, codeChallenge });
  return { url, stateToken };
}

export type CallbackOutcome =
  | { kind: 'signed_in'; userId: string; redirect: string }
  | { kind: 'connected'; redirect: string }
  | { kind: 'needs_profile'; signupToken: string }
  | { kind: 'error'; code: string; redirect: string };

const loginError = (code: string): CallbackOutcome => ({ kind: 'error', code, redirect: '/login' });

export async function handleCallback(
  providerKey: string,
  query: { code?: unknown; state?: unknown; error?: unknown },
  stateCookie: string | undefined,
  currentUserId: string | undefined,
): Promise<CallbackOutcome> {
  const st = verifyPurposeToken(STATE_PURPOSE, stateCookie);
  const connectUserId = typeof st?.connectUserId === 'string' ? st.connectUserId : undefined;
  const errorTarget = (code: string): CallbackOutcome =>
    connectUserId ? { kind: 'error', code, redirect: '/dashboard/settings' } : loginError(code);

  if (!st || st.provider !== providerKey || typeof query.state !== 'string' || query.state !== st.state) {
    return loginError('state'); // expired, tampered, or replayed request
  }
  if (query.error) return errorTarget('cancelled'); // user pressed "Cancel" on the provider page
  if (typeof query.code !== 'string' || !query.code) return errorTarget('failed');

  let profile: OAuthProfile;
  try {
    profile = await exchangeCodeForProfile(providerKey, query.code, redirectUriFor(providerKey), typeof st.codeVerifier === 'string' ? st.codeVerifier : undefined);
  } catch (e) {
    console.error(`OAuth (${providerKey}) failed:`, e instanceof Error ? e.message : e);
    return errorTarget('failed');
  }

  const redirect = safeRedirectPath(st.redirect);
  const linked = await prisma.oAuthAccount.findUnique({
    where: { provider_providerUserId: { provider: providerKey, providerUserId: profile.providerUserId } },
    include: { user: { select: { id: true, status: true } } },
  });

  // Connect a provider to the logged-in user (from Account settings).
  if (connectUserId) {
    if (currentUserId !== connectUserId) return loginError('state');
    if (linked && linked.userId !== connectUserId) return errorTarget('already_linked');
    if (!linked) {
      const existing = await prisma.oAuthAccount.findUnique({ where: { userId_provider: { userId: connectUserId, provider: providerKey } } });
      if (existing) return errorTarget('already_linked');
      await prisma.oAuthAccount.create({
        data: { userId: connectUserId, provider: providerKey, providerUserId: profile.providerUserId, email: profile.email },
      });
    }
    return { kind: 'connected', redirect };
  }

  if (linked) {
    if (linked.user.status !== 'ACTIVE') return loginError('suspended');
    return { kind: 'signed_in', userId: linked.userId, redirect };
  }

  if (!profile.email || !profile.emailVerified) return loginError('no_email');
  const byEmail = await prisma.user.findUnique({ where: { email: profile.email }, select: { id: true } });
  if (byEmail) return loginError('email_exists');

  const signupToken = signPurposeToken(
    SIGNUP_PURPOSE,
    {
      provider: providerKey,
      providerUserId: profile.providerUserId,
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
      redirect,
    },
    '15m',
  );
  return { kind: 'needs_profile', signupToken };
}

interface PendingSignup {
  provider: string;
  providerUserId: string;
  email: string;
  name: string;
  picture: string | null;
  redirect: string;
}

export function readPendingSignup(token: string | undefined): PendingSignup | null {
  const d = verifyPurposeToken(SIGNUP_PURPOSE, token);
  if (!d || typeof d.provider !== 'string' || typeof d.providerUserId !== 'string' || typeof d.email !== 'string') return null;
  return {
    provider: d.provider,
    providerUserId: d.providerUserId,
    email: d.email,
    name: typeof d.name === 'string' ? d.name : '',
    picture: typeof d.picture === 'string' ? d.picture : null,
    redirect: safeRedirectPath(d.redirect),
  };
}

export function pendingSignupView(p: PendingSignup) {
  return { provider: p.provider, providerLabel: providerLabel(p.provider), email: p.email, name: p.name, picture: p.picture };
}

export async function completeSignup(token: string | undefined, input: z.infer<typeof oauthCompleteSchema>) {
  const p = readPendingSignup(token);
  if (!p) throw ApiError.unauthorized('Your sign-up session expired. Please choose your login method again.');

  const [linked, byEmail] = await Promise.all([
    prisma.oAuthAccount.findUnique({ where: { provider_providerUserId: { provider: p.provider, providerUserId: p.providerUserId } } }),
    prisma.user.findUnique({ where: { email: p.email }, select: { id: true } }),
  ]);
  if (linked || byEmail) throw ApiError.conflict('An account with this email already exists. Please log in.');

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: p.email,
      passwordHash: null,
      phone: input.phone,
      city: input.city,
      province: provinceForCity(input.city),
      district: input.district || null,
      profileImage: p.picture,
      oauthAccounts: { create: { provider: p.provider, providerUserId: p.providerUserId, email: p.email } },
    },
    select: { id: true },
  });
  return { user: await loadMeOrThrow(user.id), redirect: p.redirect };
}

export async function disconnect(userId: string, providerKey: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { passwordHash: true, oauthAccounts: { select: { provider: true } } },
  });
  if (!user.oauthAccounts.some((a) => a.provider === providerKey)) throw ApiError.notFound('This login method is not connected');
  // Never remove the last way to log in.
  if (!user.passwordHash && user.oauthAccounts.length <= 1) {
    throw ApiError.badRequest('Set a password or connect another login method first, so you can still log in');
  }
  await prisma.oAuthAccount.delete({ where: { userId_provider: { userId, provider: providerKey } } });
  return loadMeOrThrow(userId);
}
