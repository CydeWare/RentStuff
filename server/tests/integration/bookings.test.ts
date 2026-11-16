import { beforeEach, describe, expect, it } from 'vitest';
import { createCategory, createUser, day, listingPayload, prisma, resetDb } from '../helpers.js';
import { parseDateOnly } from '../../src/utils/dates.js';

beforeEach(resetDb);

async function setup() {
  const cat = await createCategory();
  const owner = await createUser({ name: 'Owner' });
  const renter = await createUser({ name: 'Renter' });
  const renter2 = await createUser({ name: 'Second Renter' });
  const listingId = (await owner.agent.post('/api/listings').send(listingPayload(cat.id))).body.listing.id as string;
  return { owner, renter, renter2, listingId, cat };
}

const request = (listingId: string, start: number, end: number, extra: Record<string, unknown> = {}) => ({
  listingId,
  startDate: day(start),
  endDate: day(end),
  fulfillmentMethod: 'DELIVERY',
  ...extra,
});

describe('booking workflow', () => {
  it('quotes, requests, accepts, starts, completes and reviews a booking', async () => {
    const { owner, renter, listingId } = await setup();

    const quote = await renter.agent.get(`/api/listings/${listingId}/quote?startDate=${day(1)}&endDate=${day(3)}&fulfillmentMethod=DELIVERY`);
    expect(quote.body).toMatchObject({
      available: true,
      breakdown: { rentalDays: 3, rentalSubtotal: 300_000, deliveryFee: 20_000, securityDeposit: 200_000, totalDue: 520_000 },
    });

    const created = await renter.agent.post('/api/bookings').send(request(listingId, 1, 3, { note: 'Thanks!' }));
    expect(created.status).toBe(201);
    const b = created.body.booking;
    expect(b).toMatchObject({ status: 'PENDING', paymentStatus: 'UNPAID', rentalDays: 3, totalPrice: 520_000, depositSnapshot: 200_000 });
    expect(b.owner.phone).toBeNull(); // contact details hidden until accepted

    // Owner was notified
    expect(await prisma.notification.count({ where: { userId: owner.user.id, type: 'BOOKING_REQUEST' } })).toBe(1);
    const incoming = (await owner.agent.get('/api/bookings?role=owner')).body.items;
    expect(incoming).toHaveLength(1);

    // Renter cannot accept their own request
    expect((await renter.agent.post(`/api/bookings/${b.id}/actions`).send({ action: 'accept' })).status).toBe(403);
    const accepted = await owner.agent.post(`/api/bookings/${b.id}/actions`).send({ action: 'accept' });
    expect(accepted.status).toBe(200);
    expect(accepted.body.booking.status).toBe('ACCEPTED');
    expect(accepted.body.booking.renter.phone).toBe('081234567890');

    // Simulated payment is clearly not real
    const paid = await renter.agent.post(`/api/bookings/${b.id}/actions`).send({ action: 'simulate_payment' });
    expect(paid.body.booking.paymentStatus).toBe('SIMULATED_PAID');

    // Cannot start before the start date
    expect((await owner.agent.post(`/api/bookings/${b.id}/actions`).send({ action: 'start' })).status).toBe(409);
    // Review not allowed before completion
    expect((await renter.agent.post(`/api/bookings/${b.id}/review`).send({ rating: 5, comment: 'Great experience overall' })).status).toBe(403);

    // Move the booking into the past to simulate time passing
    await prisma.booking.update({ where: { id: b.id }, data: { startDate: parseDateOnly(day(0)), endDate: parseDateOnly(day(2)) } });
    expect((await owner.agent.post(`/api/bookings/${b.id}/actions`).send({ action: 'start' })).body.booking.status).toBe('ACTIVE');
    const completed = await owner.agent.post(`/api/bookings/${b.id}/actions`).send({ action: 'complete' });
    expect(completed.body.booking.status).toBe('COMPLETED');
    expect(await prisma.notification.count({ where: { userId: renter.user.id, type: 'BOOKING_COMPLETED' } })).toBe(1);

    // Only the renter can review, only once
    expect((await owner.agent.post(`/api/bookings/${b.id}/review`).send({ rating: 5, comment: 'Reviewing myself!!' })).status).toBe(404);
    const review = await renter.agent.post(`/api/bookings/${b.id}/review`).send({ rating: 4, comment: 'Camera worked perfectly, thanks!' });
    expect(review.status).toBe(201);
    expect((await renter.agent.post(`/api/bookings/${b.id}/review`).send({ rating: 5, comment: 'Second review attempt' })).status).toBe(409);

    const ownerRow = await prisma.user.findUniqueOrThrow({ where: { id: owner.user.id } });
    expect(ownerRow.ratingAvg).toBe(4);
    expect(ownerRow.ratingCount).toBe(1);
    const listingRow = await prisma.listing.findUniqueOrThrow({ where: { id: listingId } });
    expect(listingRow.reviewCount).toBe(1);

    // Booking history and earnings
    const history = (await renter.agent.get('/api/bookings?role=renter&status=COMPLETED')).body.items;
    expect(history).toHaveLength(1);
    expect((await owner.agent.get('/api/me/overview')).body.totalEarnings).toBe(320_000);
  });

  it('prevents owners from booking their own items', async () => {
    const { owner, listingId } = await setup();
    const res = await owner.agent.post('/api/bookings').send(request(listingId, 1, 2));
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/own item/);
  });

  it('rejects invalid date ranges on the backend', async () => {
    const { renter, listingId } = await setup();
    expect((await renter.agent.post('/api/bookings').send(request(listingId, 3, 1))).status).toBe(400);
    expect((await renter.agent.post('/api/bookings').send(request(listingId, -2, 1))).status).toBe(400);
    expect((await renter.agent.post('/api/bookings').send({ ...request(listingId, 1, 2), startDate: '2026-13-45' })).status).toBe(400);
    expect((await renter.agent.post('/api/bookings').send(request(listingId, 400, 401))).status).toBe(400);
  });

  it('prevents overlapping confirmed bookings', async () => {
    const { owner, renter, renter2, listingId } = await setup();
    const a = (await renter.agent.post('/api/bookings').send(request(listingId, 5, 8))).body.booking;
    const b = (await renter2.agent.post('/api/bookings').send(request(listingId, 7, 10))).body.booking;
    const c = (await renter2.agent.post('/api/bookings').send(request(listingId, 12, 13))).body.booking;
    expect(a.status).toBe('PENDING');
    expect(b.status).toBe('PENDING'); // pending requests may overlap

    await owner.agent.post(`/api/bookings/${a.id}/actions`).send({ action: 'accept' });

    // Overlapping pending request was auto-rejected, the non-overlapping one is untouched
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).status).toBe('REJECTED');
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: c.id } })).status).toBe('PENDING');

    // New requests for overlapping dates are refused, and quotes report unavailability
    const overlap = await renter2.agent.post('/api/bookings').send(request(listingId, 8, 9));
    expect(overlap.status).toBe(409);
    const quote = await renter2.agent.get(`/api/listings/${listingId}/quote?startDate=${day(6)}&endDate=${day(6)}`);
    expect(quote.body.available).toBe(false);

    // Search with dates excludes the listing
    const search = await renter2.agent.get(`/api/listings?startDate=${day(6)}&endDate=${day(7)}`);
    expect(search.body.total).toBe(0);

    // Adjacent dates are fine
    expect((await renter2.agent.post('/api/bookings').send(request(listingId, 9, 10))).status).toBe(201);
  });

  it('enforces non-overlap at the database level too', async () => {
    const { owner, renter, listingId } = await setup();
    const base = {
      listingId,
      ownerId: owner.user.id,
      renterId: renter.user.id,
      rentalDays: 3,
      dailyPriceSnapshot: 1,
      rentalPriceSnapshot: 3,
      depositSnapshot: 0,
      deliveryFeeSnapshot: 0,
      totalPrice: 3,
      listingTitleSnapshot: 'x',
      status: 'ACCEPTED' as const,
    };
    await prisma.booking.create({ data: { ...base, startDate: parseDateOnly(day(1)), endDate: parseDateOnly(day(3)) } });
    await expect(
      prisma.booking.create({ data: { ...base, startDate: parseDateOnly(day(3)), endDate: parseDateOnly(day(5)) } }),
    ).rejects.toThrow();
  });

  it('respects owner-blocked dates', async () => {
    const { owner, renter, listingId, cat } = await setup();
    await owner.agent
      .put(`/api/listings/${listingId}`)
      .send(listingPayload(cat.id, { blockedDates: [{ startDate: day(4), endDate: day(6), note: 'Holiday' }] }));
    expect((await renter.agent.post('/api/bookings').send(request(listingId, 5, 5))).status).toBe(409);
  });

  it('keeps the price snapshot when the listing price changes', async () => {
    const { owner, renter, listingId, cat } = await setup();
    const b = (await renter.agent.post('/api/bookings').send(request(listingId, 1, 2))).body.booking;
    await owner.agent.post(`/api/bookings/${b.id}/actions`).send({ action: 'accept' });
    await owner.agent.put(`/api/listings/${listingId}`).send(listingPayload(cat.id, { dailyPrice: 999_000, securityDeposit: 5_000_000 }));
    const after = (await renter.agent.get(`/api/bookings/${b.id}`)).body.booking;
    expect(after.rentalPriceSnapshot).toBe(200_000);
    expect(after.depositSnapshot).toBe(200_000);
    expect(after.totalPrice).toBe(b.totalPrice);
  });

  it('hides bookings from unrelated users', async () => {
    const { renter, renter2, listingId } = await setup();
    const b = (await renter.agent.post('/api/bookings').send(request(listingId, 1, 2))).body.booking;
    expect((await renter2.agent.get(`/api/bookings/${b.id}`)).status).toBe(404);
    expect((await renter2.agent.post(`/api/bookings/${b.id}/actions`).send({ action: 'cancel' })).status).toBe(404);
    expect((await renter2.agent.get('/api/bookings?role=renter')).body.items).toHaveLength(0);
  });

  it('lets the renter cancel and refuses invalid transitions', async () => {
    const { owner, renter, listingId } = await setup();
    const b = (await renter.agent.post('/api/bookings').send(request(listingId, 1, 2))).body.booking;
    expect((await renter.agent.post(`/api/bookings/${b.id}/actions`).send({ action: 'cancel' })).body.booking.status).toBe('CANCELLED');
    expect((await owner.agent.post(`/api/bookings/${b.id}/actions`).send({ action: 'accept' })).status).toBe(409);
    expect(await prisma.notification.count({ where: { userId: owner.user.id, type: 'BOOKING_CANCELLED' } })).toBe(1);
  });
});
