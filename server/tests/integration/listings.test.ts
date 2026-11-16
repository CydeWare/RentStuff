import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app, createCategory, createUser, listingPayload, prisma, resetDb } from '../helpers.js';

beforeEach(resetDb);

describe('listings', () => {
  it('creates, edits, pauses and deletes a listing (owner only)', async () => {
    const cat = await createCategory();
    const { agent: owner } = await createUser();
    const { agent: other } = await createUser();

    const created = await owner.post('/api/listings').send(listingPayload(cat.id));
    expect(created.status).toBe(201);
    const id = created.body.listing.id;

    const edited = await owner.put(`/api/listings/${id}`).send(listingPayload(cat.id, { title: 'Canon EOS Updated', dailyPrice: 90_000 }));
    expect(edited.status).toBe(200);
    expect((await request(app).get(`/api/listings/${id}`)).body.listing.title).toBe('Canon EOS Updated');

    // Another user cannot modify it
    expect((await other.put(`/api/listings/${id}`).send(listingPayload(cat.id))).status).toBe(403);
    expect((await other.patch(`/api/listings/${id}/status`).send({ status: 'PAUSED' })).status).toBe(403);
    expect((await other.delete(`/api/listings/${id}`)).status).toBe(403);

    // Paused listings disappear from search and their page is hidden from others
    expect((await owner.patch(`/api/listings/${id}/status`).send({ status: 'PAUSED' })).status).toBe(200);
    expect((await request(app).get('/api/listings')).body.total).toBe(0);
    expect((await request(app).get(`/api/listings/${id}`)).status).toBe(404);
    expect((await owner.get(`/api/listings/${id}`)).status).toBe(200);

    expect((await owner.delete(`/api/listings/${id}`)).status).toBe(204);
    expect((await owner.get('/api/listings/mine')).body.items).toHaveLength(0);
  });

  it('validates listing input', async () => {
    const cat = await createCategory();
    const { agent } = await createUser();
    const res = await agent.post('/api/listings').send(listingPayload(cat.id, { title: 'x', dailyPrice: -5, images: [] }));
    expect(res.status).toBe(400);
    const bad = await agent.post('/api/listings').send(listingPayload(cat.id, { pickupAvailable: false, deliveryAvailable: false }));
    expect(bad.status).toBe(400);
    const evilImage = await agent.post('/api/listings').send(listingPayload(cat.id, { images: ['javascript:alert(1)'] }));
    expect(evilImage.status).toBe(400);
    const wrongCity = await agent.post('/api/listings').send(listingPayload(cat.id, { province: 'Bali' }));
    expect(wrongCity.status).toBe(400);
  });

  it('searches, filters and sorts using the database', async () => {
    const cat = await createCategory();
    const tools = await prisma.category.create({ data: { slug: 'tools', name: 'Tools', icon: 'Wrench' } });
    const { agent } = await createUser();
    await agent.post('/api/listings').send(listingPayload(cat.id, { title: 'Sony Camera Kit', dailyPrice: 150_000 }));
    await agent.post('/api/listings').send(listingPayload(cat.id, { title: 'Budget Laptop', description: 'Simple laptop for office work and online classes.', dailyPrice: 60_000, weeklyPrice: null, city: 'Jakarta Barat', condition: 'FAIR' }));
    await agent.post('/api/listings').send(listingPayload(tools.id, { title: 'Cordless Drill', description: 'Cordless drill with batteries and a full bit set.', dailyPrice: 40_000, weeklyPrice: null, province: 'Jawa Barat', city: 'Depok' }));

    const q = (s: string) => request(app).get(`/api/listings?${s}`).then((r) => r.body);
    expect((await q('q=camera')).items.map((i: { title: string }) => i.title)).toEqual(['Sony Camera Kit']);
    expect((await q('category=tools')).total).toBe(1);
    expect((await q('city=Jakarta%20Barat')).total).toBe(1);
    expect((await q('city=DKI%20Jakarta')).total).toBe(2); // province covers its cities
    expect((await q('minPrice=50000&maxPrice=100000')).total).toBe(1);
    expect((await q('condition=FAIR')).total).toBe(1);
    expect((await q('sort=price_asc')).items.map((i: { dailyPrice: number }) => i.dailyPrice)).toEqual([40_000, 60_000, 150_000]);
    expect((await q('sort=price_desc')).items[0].dailyPrice).toBe(150_000);
    expect((await q('limit=2&page=2')).items).toHaveLength(1);
    expect((await request(app).get('/api/listings?minPrice=100&maxPrice=1')).status).toBe(400);
  });

  it('adds and removes favorites', async () => {
    const cat = await createCategory();
    const { agent: owner } = await createUser();
    const { agent } = await createUser();
    const id = (await owner.post('/api/listings').send(listingPayload(cat.id))).body.listing.id;

    expect((await agent.post(`/api/listings/${id}/favorite`)).status).toBe(201);
    expect((await agent.post(`/api/listings/${id}/favorite`)).status).toBe(201); // idempotent
    expect((await agent.get('/api/me/favorites')).body.items).toHaveLength(1);
    expect((await agent.get(`/api/listings/${id}`)).body.listing.isFavorited).toBe(true);
    await agent.delete(`/api/listings/${id}/favorite`);
    expect((await agent.get('/api/me/favorites')).body.items).toHaveLength(0);
  });

  it('accepts reports once per user and shows them to admins', async () => {
    const cat = await createCategory();
    const { agent: owner } = await createUser();
    const { agent } = await createUser();
    const { agent: admin } = await createUser({ role: 'ADMIN' });
    const id = (await owner.post('/api/listings').send(listingPayload(cat.id))).body.listing.id;

    expect((await owner.post(`/api/listings/${id}/report`).send({ reason: 'SCAM' })).status).toBe(400);
    expect((await agent.post(`/api/listings/${id}/report`).send({ reason: 'SCAM', description: 'Fake' })).status).toBe(201);
    expect((await agent.post(`/api/listings/${id}/report`).send({ reason: 'SCAM' })).status).toBe(409);

    const reports = (await admin.get('/api/admin/reports')).body.items;
    expect(reports).toHaveLength(1);
    await admin.patch(`/api/admin/reports/${reports[0].id}`).send({ status: 'RESOLVED', removeListing: true });
    expect((await request(app).get(`/api/listings/${id}`)).status).toBe(404);
  });
});
