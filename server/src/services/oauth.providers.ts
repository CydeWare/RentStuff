/**
 * Social login providers (OAuth 2.0 authorization-code flow).
 *
 * To add a provider: add an entry to PROVIDER_DEFS with its endpoints and a
 * fetchProfile() that returns a normalized profile, then add its env variables.
 * A provider is enabled only when both its client ID and secret are configured.
 */
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

export interface OAuthProfile {
  providerUserId: string;
  email: string | null;
  /** Whether the provider guarantees the user controls this email. */
  emailVerified: boolean;
  name: string;
  picture: string | null;
}

interface ProviderDef {
  label: string;
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
  /** Send a PKCE code challenge (all three providers support it, but it is per-provider). */
  pkce: boolean;
  extraAuthParams?: Record<string, string>;
  clientId?: string;
  clientSecret?: string;
  fetchProfile: (accessToken: string) => Promise<OAuthProfile>;
}

const FACEBOOK_GRAPH = 'https://graph.facebook.com/v24.0';

async function getJson<T>(url: string, accessToken: string, headers: Record<string, string> = {}): Promise<T> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json', ...headers } });
  if (!res.ok) throw new Error(`Profile request failed (${res.status})`);
  return (await res.json()) as T;
}

const PROVIDER_DEFS: Record<string, ProviderDef> = {
  google: {
    label: 'Google',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'openid email profile',
    pkce: true,
    extraAuthParams: { prompt: 'select_account' },
    clientId: env.OAUTH_GOOGLE_CLIENT_ID,
    clientSecret: env.OAUTH_GOOGLE_CLIENT_SECRET,
    async fetchProfile(token) {
      const p = await getJson<{ sub: string; email?: string; email_verified?: boolean; name?: string; picture?: string }>(
        'https://openidconnect.googleapis.com/v1/userinfo',
        token,
      );
      return { providerUserId: p.sub, email: p.email ?? null, emailVerified: p.email_verified === true, name: p.name ?? '', picture: p.picture ?? null };
    },
  },
  facebook: {
    label: 'Facebook',
    authorizeUrl: 'https://www.facebook.com/v24.0/dialog/oauth',
    tokenUrl: `${FACEBOOK_GRAPH}/oauth/access_token`,
    scope: 'email public_profile',
    pkce: false,
    clientId: env.OAUTH_FACEBOOK_CLIENT_ID,
    clientSecret: env.OAUTH_FACEBOOK_CLIENT_SECRET,
    async fetchProfile(token) {
      const p = await getJson<{ id: string; name?: string; email?: string; picture?: { data?: { url?: string; is_silhouette?: boolean } } }>(
        `${FACEBOOK_GRAPH}/me?fields=id,name,email,picture.type(large)`,
        token,
      );
      const pic = p.picture?.data;
      // Facebook only returns an email that the user has confirmed.
      return { providerUserId: p.id, email: p.email ?? null, emailVerified: Boolean(p.email), name: p.name ?? '', picture: pic && !pic.is_silhouette ? pic.url ?? null : null };
    },
  },
  github: {
    label: 'GitHub',
    authorizeUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    scope: 'read:user user:email',
    pkce: true,
    clientId: env.OAUTH_GITHUB_CLIENT_ID,
    clientSecret: env.OAUTH_GITHUB_CLIENT_SECRET,
    async fetchProfile(token) {
      const headers = { 'User-Agent': 'Rentora', 'X-GitHub-Api-Version': '2022-11-28' };
      const [user, emails] = await Promise.all([
        getJson<{ id: number; login: string; name: string | null; avatar_url?: string }>('https://api.github.com/user', token, headers),
        getJson<{ email: string; primary: boolean; verified: boolean }[]>('https://api.github.com/user/emails', token, headers),
      ]);
      const primary = emails.find((e) => e.primary && e.verified) ?? emails.find((e) => e.verified);
      return { providerUserId: String(user.id), email: primary?.email ?? null, emailVerified: Boolean(primary), name: user.name || user.login, picture: user.avatar_url ?? null };
    },
  },
};

export type ProviderKey = string;

export function getProvider(key: string): (ProviderDef & { key: string; clientId: string; clientSecret: string }) | null {
  const def = Object.prototype.hasOwnProperty.call(PROVIDER_DEFS, key) ? PROVIDER_DEFS[key] : undefined;
  if (!def?.clientId || !def.clientSecret) return null;
  return { ...def, key, clientId: def.clientId, clientSecret: def.clientSecret };
}

/** Providers that are configured, in display order. Safe to send to the browser. */
export function enabledProviders() {
  return Object.keys(PROVIDER_DEFS)
    .filter((k) => getProvider(k))
    .map((k) => ({ key: k, label: PROVIDER_DEFS[k]!.label }));
}

export function providerLabel(key: string) {
  return PROVIDER_DEFS[key]?.label ?? key;
}

export function buildAuthorizeUrl(
  provider: NonNullable<ReturnType<typeof getProvider>>,
  opts: { redirectUri: string; state: string; codeChallenge?: string },
) {
  const url = new URL(provider.authorizeUrl);
  url.searchParams.set('client_id', provider.clientId);
  url.searchParams.set('redirect_uri', opts.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', provider.scope);
  url.searchParams.set('state', opts.state);
  if (provider.pkce && opts.codeChallenge) {
    url.searchParams.set('code_challenge', opts.codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
  }
  for (const [k, v] of Object.entries(provider.extraAuthParams ?? {})) url.searchParams.set(k, v);
  return url.toString();
}

/**
 * Exchanges the authorization code for an access token (server to server, with the
 * client secret) and loads the user's profile from the provider.
 */
export async function exchangeCodeForProfile(
  providerKey: string,
  code: string,
  redirectUri: string,
  codeVerifier: string | undefined,
): Promise<OAuthProfile> {
  const provider = getProvider(providerKey);
  if (!provider) throw ApiError.notFound('Unknown login provider');
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: provider.clientId,
    client_secret: provider.clientSecret,
  });
  if (provider.pkce && codeVerifier) body.set('code_verifier', codeVerifier);

  const res = await fetch(provider.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body,
  });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string };
  if (!res.ok || !data.access_token) throw new Error(`Token exchange failed (${res.status})`);
  const profile = await provider.fetchProfile(data.access_token);
  return { ...profile, email: profile.email?.toLowerCase() ?? null, name: profile.name.trim().slice(0, 80) };
}
