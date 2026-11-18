import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OAuthProfile } from '../../src/services/oauth.providers.js';

// Replace only the network call to the provider; everything else is real.
const providerProfile = vi.hoisted(() => ({ current: null as OAuthProfile | null, calls: [] as unknown[][] }));
vi.mock('../../src/services/oauth.providers.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../src/services/oauth.providers.js')>();
  return {
    ...mod,
    exchangeCodeForProfile: vi.fn(async (...args: unknown[]) => {
      providerProfile.calls.push(args);
      if (!providerProfile.current) throw new Error('provider error');
      return providerProfile.current;
    }),
  };
});

const { app, createUser, prisma, resetDb } = await import('../helpers.js');
const { signToken } = await import('../../src/utils/auth.js');

beforeEach(async () => {
  await resetDb();
  providerProfile.calls = [];
  providerProfile.current = {
    providerUserId: 'g-123',
    email: 'dian@gmail.com',
    emailVerified: true,
    name: 'Dian Permata',
    picture: 'https://lh3.googleusercontent.com/a/photo',
  };
});

type Agent = ReturnType<typeof request.agent>;

/** Runs start -> provider -> callback and returns the final redirect location. */
async function socialLogin(agent: Agent, provider = 'google', startQuery = 'redirect=%2Fexplore') {
  const start = await agent.get(`/api/auth/oauth/${provider}/start?${startQuery}`);
  expect(start.status).toBe(302);
  const authUrl = new URL(start.headers.location!);
  const state = authUrl.searchParams.get('state');
  const cb = await agent.get(`/api/auth/oauth/${provider}/callback?code=abc&state=${state}`);
  expect(cb.status).toBe(302);
  return { location: cb.headers.location as string, authUrl };
}

describe('social login', () => {
  it('lists only configured providers, without secrets', async () => {
    const res = await request(app).get('/api/meta/config');
    expect(res.body.oauthProviders).toEqual([
      { key: 'google', label: 'Google' },
      { key: 'facebook', label: 'Facebook' },
    ]);
    expect(JSON.stringify(res.body)).not.toContain('secret');
  });

  it('redirects to the provider with state, PKCE and the right redirect URI', async () => {
    const res = await request(app).get('/api/auth/oauth/google/start');
    const url = new URL(res.headers.location!);
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('client_id')).toBe('test-google-id');
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:5173/api/auth/oauth/google/callback');
    expect(url.searchParams.get('state')).toBeTruthy();
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(res.headers['set-cookie']?.[0]).toMatch(/rentora_oauth_state=.*HttpOnly/i);
  });

  it('refuses unconfigured or unknown providers', async () => {
    for (const p of ['github', 'myspace', '__proto__']) {
      const res = await request(app).get(`/api/auth/oauth/${p}/start`);
      expect(res.headers.location).toBe('/login?oauthError=unavailable');
    }
  });

  it('rejects a callback whose state does not match (CSRF)', async () => {
    const agent = request.agent(app);
    await agent.get('/api/auth/oauth/google/start');
    const cb = await agent.get('/api/auth/oauth/google/callback?code=abc&state=forged');
    expect(cb.headers.location).toBe('/login?oauthError=state&provider=google');
    expect(providerProfile.calls).toHaveLength(0);
    // And without any state cookie
    const cb2 = await request(app).get('/api/auth/oauth/google/callback?code=abc&state=x');
    expect(cb2.headers.location).toContain('oauthError=state');
  });

  it('signs up a new user, who must add a phone number and city', async () => {
    const agent = request.agent(app);
    const { location } = await socialLogin(agent);
    expect(location).toBe('/complete-signup');
    expect(await prisma.user.count()).toBe(0); // nothing created yet

    const pending = await agent.get('/api/auth/oauth/signup');
    expect(pending.body.pending).toMatchObject({ provider: 'google', providerLabel: 'Google', email: 'dian@gmail.com', name: 'Dian Permata' });
    // The pending signup is not a session
    expect((await agent.get('/api/auth/me')).body.user).toBeNull();

    expect((await agent.post('/api/auth/oauth/complete').send({ name: 'Dian Permata', phone: '123', city: 'Jakarta Selatan' })).status).toBe(400);
    const done = await agent.post('/api/auth/oauth/complete').send({ name: 'Dian P.', phone: '0812 3456 7890', city: 'Depok', district: 'Beji' });
    expect(done.status).toBe(201);
    expect(done.body.redirect).toBe('/explore');
    expect(done.body.user).toMatchObject({ name: 'Dian P.', email: 'dian@gmail.com', hasPassword: false, connectedProviders: ['google'], province: 'Jawa Barat' });
    expect(done.body.user.passwordHash).toBeUndefined();

    expect((await agent.get('/api/auth/me')).body.user.email).toBe('dian@gmail.com');
    expect((await agent.get('/api/auth/oauth/signup')).body.pending).toBeNull();
    // The signup cookie is single use
    expect((await agent.post('/api/auth/oauth/complete').send({ name: 'Again', phone: '081234567890', city: 'Depok' })).status).toBe(401);
  });

  it('signs a returning user straight in and honours the redirect', async () => {
    const first = request.agent(app);
    await socialLogin(first);
    await first.post('/api/auth/oauth/complete').send({ name: 'Dian', phone: '081234567890', city: 'Depok' });

    const agent = request.agent(app);
    const { location } = await socialLogin(agent, 'google', 'redirect=%2Fitems%2Fabc');
    expect(location).toBe('/items/abc');
    expect((await agent.get('/api/auth/me')).body.user.email).toBe('dian@gmail.com');
  });

  it('ignores open-redirect attempts', async () => {
    const first = request.agent(app);
    await socialLogin(first);
    await first.post('/api/auth/oauth/complete').send({ name: 'Dian', phone: '081234567890', city: 'Depok' });
    for (const evil of ['https%3A%2F%2Fevil.com', '%2F%2Fevil.com', '%2F%5Cevil.com']) {
      const { location } = await socialLogin(request.agent(app), 'google', `redirect=${evil}`);
      expect(location).toBe('/dashboard');
    }
  });

  it('does not auto-link to an existing email/password account', async () => {
    const { user } = await createUser();
    providerProfile.current!.email = user.email;
    const agent = request.agent(app);
    const { location } = await socialLogin(agent);
    expect(location).toBe('/login?oauthError=email_exists&provider=google');
    expect(await prisma.oAuthAccount.count()).toBe(0);
    expect((await agent.get('/api/auth/me')).body.user).toBeNull();
  });

  it('lets a logged-in user connect a provider, then log in with it', async () => {
    const { user, agent } = await createUser();
    providerProfile.current!.email = 'other-address@gmail.com'; // provider email may differ
    const { location } = await socialLogin(agent, 'google', 'mode=connect');
    expect(location).toBe('/dashboard/settings?connected=google');
    expect((await agent.get('/api/auth/me')).body.user.connectedProviders).toEqual(['google']);

    const fresh = request.agent(app);
    await socialLogin(fresh);
    expect((await fresh.get('/api/auth/me')).body.user.id).toBe(user.id);
  });

  it('will not connect a provider account already used by someone else', async () => {
    const owner = request.agent(app);
    await socialLogin(owner);
    await owner.post('/api/auth/oauth/complete').send({ name: 'Dian', phone: '081234567890', city: 'Depok' });
    const { agent } = await createUser();
    const { location } = await socialLogin(agent, 'google', 'mode=connect');
    expect(location).toBe('/dashboard/settings?oauthError=already_linked&provider=google');
  });

  it('sends guests who try to connect to the login page', async () => {
    const res = await request(app).get('/api/auth/oauth/google/start?mode=connect');
    expect(res.headers.location).toBe('/login?redirect=%2Fdashboard%2Fsettings');
  });

  it('rejects provider accounts without a verified email', async () => {
    providerProfile.current!.emailVerified = false;
    expect((await socialLogin(request.agent(app))).location).toContain('oauthError=no_email');
    providerProfile.current = { ...providerProfile.current!, email: null, emailVerified: false };
    expect((await socialLogin(request.agent(app), 'facebook')).location).toContain('oauthError=no_email');
  });

  it('handles provider failures and cancellations', async () => {
    providerProfile.current = null;
    expect((await socialLogin(request.agent(app))).location).toContain('oauthError=failed');

    const agent = request.agent(app);
    const start = await agent.get('/api/auth/oauth/google/start');
    const state = new URL(start.headers.location!).searchParams.get('state');
    const cb = await agent.get(`/api/auth/oauth/google/callback?error=access_denied&state=${state}`);
    expect(cb.headers.location).toContain('oauthError=cancelled');
  });

  it('blocks suspended users', async () => {
    const agent = request.agent(app);
    await socialLogin(agent);
    const { body } = await agent.post('/api/auth/oauth/complete').send({ name: 'Dian', phone: '081234567890', city: 'Depok' });
    await prisma.user.update({ where: { id: body.user.id }, data: { status: 'SUSPENDED' } });
    expect((await socialLogin(request.agent(app))).location).toContain('oauthError=suspended');
  });

  it('social-only accounts cannot use password login, can set a password, and keep a way to log in', async () => {
    const agent = request.agent(app);
    await socialLogin(agent);
    await agent.post('/api/auth/oauth/complete').send({ name: 'Dian', phone: '081234567890', city: 'Depok' });

    expect((await request(app).post('/api/auth/login').send({ email: 'dian@gmail.com', password: 'anything1' })).status).toBe(401);
    // Removing the only login method is refused
    expect((await agent.delete('/api/me/oauth/google')).status).toBe(400);

    const set = await agent.put('/api/me/password').send({ newPassword: 'NewPass123' });
    expect(set.status).toBe(200);
    expect(set.body.user.hasPassword).toBe(true);
    expect((await request(app).post('/api/auth/login').send({ email: 'dian@gmail.com', password: 'NewPass123' })).status).toBe(200);
    // Now a current password is required to change it
    expect((await agent.put('/api/me/password').send({ newPassword: 'Other1234' })).status).toBe(400);

    const disc = await agent.delete('/api/me/oauth/google');
    expect(disc.status).toBe(200);
    expect(disc.body.user.connectedProviders).toEqual([]);
  });

  it('never accepts state or signup tokens as a session', async () => {
    const agent = request.agent(app);
    const start = await agent.get('/api/auth/oauth/google/start');
    const stateToken = /rentora_oauth_state=([^;]+)/.exec(start.headers['set-cookie']![0]!)![1];
    const me = await request(app).get('/api/auth/me').set('Cookie', `rentora_token=${stateToken}`);
    expect(me.body.user).toBeNull();
    // Sanity check: a real session token works
    const { user } = await createUser();
    const ok = await request(app).get('/api/auth/me').set('Cookie', `rentora_token=${signToken(user.id)}`);
    expect(ok.body.user.id).toBe(user.id);
  });
});
