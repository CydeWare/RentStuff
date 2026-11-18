import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { addDays, todayInMarket, toDateString } from '../src/utils/dates.js';
import { hashPassword } from '../src/services/auth.service.js';

export const app = createApp();
export { prisma };

export const PASSWORD = 'Password123';

export async function resetDb() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE "Notification", "Message", "ConversationParticipant", "Conversation", "Review", "Report",
      "Favorite", "Booking", "ListingBlockedDate", "ListingImage", "Listing", "Category", "User" CASCADE
  `);
}

let counter = 0;
export async function createUser(overrides: { role?: 'USER' | 'ADMIN'; name?: string } = {}) {
  counter++;
  const email = `user${counter}-${Date.now()}@test.local`;
  const user = await prisma.user.create({
    data: {
      name: overrides.name ?? `Test User ${counter}`,
      email,
      passwordHash: await hashPassword(PASSWORD),
      phone: '081234567890',
      city: 'Jakarta Selatan',
      province: 'DKI Jakarta',
      role: overrides.role ?? 'USER',
    },
  });
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ email, password: PASSWORD });
  if (res.status !== 200) throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { user, agent };
}

export async function createCategory() {
  return prisma.category.upsert({
    where: { slug: 'electronics' },
    create: { slug: 'electronics', name: 'Electronics', icon: 'Laptop' },
    update: {},
  });
}

export function listingPayload(categoryId: string, overrides: Record<string, unknown> = {}) {
  return {
    title: 'Canon EOS Test Camera',
    description: 'A well maintained camera with lens, battery and charger for testing.',
    categoryId,
    dailyPrice: 100_000,
    weeklyPrice: 600_000,
    monthlyPrice: null,
    securityDeposit: 200_000,
    condition: 'GOOD',
    province: 'DKI Jakarta',
    city: 'Jakarta Selatan',
    district: 'Tebet',
    address: 'Pickup near Tebet station',
    pickupAvailable: true,
    deliveryAvailable: true,
    deliveryFee: 20_000,
    minRentalDays: 1,
    maxRentalDays: null,
    images: ['https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=800'],
    blockedDates: [],
    ...overrides,
  };
}

/** Date string `n` days from today (marketplace timezone). */
export function day(n: number) {
  return toDateString(addDays(todayInMarket(), n));
}
