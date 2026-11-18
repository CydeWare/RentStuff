import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app, createUser, prisma, resetDb } from '../helpers.js';

beforeEach(resetDb);

describe('authentication', () => {
  const valid = {
    name: 'Rina Wulandari',
    email: 'Rina@Example.com',
    password: 'Secret123',
    phone: '0812-3456-7890',
    city: 'Jakarta Selatan',
  };

  it('registers, persists the session cookie, logs out', async () => {
    const agent = request.agent(app);
    const reg = await agent.post('/api/auth/register').send(valid);
    expect(reg.status).toBe(201);
    expect(reg.body.user.email).toBe('rina@example.com');
    expect(reg.body.user.passwordHash).toBeUndefined();
    expect(reg.headers['set-cookie']?.[0]).toMatch(/rentora_token=.*HttpOnly/i);

    const stored = await prisma.user.findUniqueOrThrow({ where: { email: 'rina@example.com' } });
    expect(stored.passwordHash).not.toBe(valid.password);
    expect(stored.phone).toBe('081234567890');
    expect(stored.province).toBe('DKI Jakarta');

    expect((await agent.get('/api/auth/me')).body.user.name).toBe('Rina Wulandari');
    await agent.post('/api/auth/logout');
    expect((await agent.get('/api/auth/me')).body.user).toBeNull();

    const login = await agent.post('/api/auth/login').send({ email: valid.email, password: valid.password });
    expect(login.status).toBe(200);
  });

  it('rejects duplicate emails, weak passwords, bad phones and unsupported cities', async () => {
    await request(app).post('/api/auth/register').send(valid);
    expect((await request(app).post('/api/auth/register').send(valid)).status).toBe(409);
    const weak = await request(app).post('/api/auth/register').send({ ...valid, email: 'a@b.co', password: 'short' });
    expect(weak.status).toBe(400);
    expect(weak.body.error.details.fieldErrors.password).toBeDefined();
    expect((await request(app).post('/api/auth/register').send({ ...valid, email: 'c@d.co', phone: '12345' })).status).toBe(400);
    expect((await request(app).post('/api/auth/register').send({ ...valid, email: 'e@f.co', city: 'Atlantis' })).status).toBe(400);
  });

  it('rejects wrong passwords with a generic message', async () => {
    await request(app).post('/api/auth/register').send(valid);
    const res = await request(app).post('/api/auth/login').send({ email: valid.email, password: 'Wrong1234' });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Incorrect email or password');
  });

  it('requires authentication for private endpoints', async () => {
    for (const path of ['/api/me/overview', '/api/bookings', '/api/conversations', '/api/notifications', '/api/me/favorites']) {
      expect((await request(app).get(path)).status).toBe(401);
    }
  });

  it('blocks non-admin users from every admin endpoint', async () => {
    const { agent } = await createUser();
    for (const path of ['/api/admin/stats', '/api/admin/users', '/api/admin/listings', '/api/admin/bookings', '/api/admin/reports']) {
      expect((await agent.get(path)).status).toBe(403);
    }
    expect((await agent.patch('/api/admin/users/abc/status').send({ status: 'SUSPENDED' })).status).toBe(403);
  });

  it('lets admins suspend users, which ends their session', async () => {
    const { agent: admin } = await createUser({ role: 'ADMIN' });
    const { user, agent } = await createUser();
    expect((await admin.get('/api/admin/stats')).status).toBe(200);
    expect((await admin.patch(`/api/admin/users/${user.id}/status`).send({ status: 'SUSPENDED' })).status).toBe(200);
    expect((await agent.get('/api/me/overview')).status).toBe(401);
    const relogin = await request(app).post('/api/auth/login').send({ email: user.email, password: 'Password123' });
    expect(relogin.status).toBe(403);
  });
});
