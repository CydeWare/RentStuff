import { describe, expect, it } from 'vitest';
import type { BookingStatus } from '@prisma/client';
import { nextStatus } from '../../src/services/booking.rules.js';
import { parseDateOnly } from '../../src/utils/dates.js';

const today = parseDateOnly('2026-06-10');
const base = {
  renterId: 'renter',
  ownerId: 'owner',
  startDate: parseDateOnly('2026-06-12'),
  endDate: parseDateOnly('2026-06-14'),
  paymentStatus: 'UNPAID' as 'UNPAID' | 'SIMULATED_PAID' | 'SIMULATED_REFUNDED',
};
const b = (status: BookingStatus, extra: Partial<typeof base> = {}) => ({ ...base, ...extra, status });

describe('booking state machine', () => {
  it('lets only the owner accept or reject pending requests', () => {
    expect(nextStatus(b('PENDING'), 'accept', 'owner', today)).toBe('ACCEPTED');
    expect(nextStatus(b('PENDING'), 'reject', 'owner', today)).toBe('REJECTED');
    expect(() => nextStatus(b('PENDING'), 'accept', 'renter', today)).toThrow(/owner/);
  });

  it('hides bookings from non-participants', () => {
    expect(() => nextStatus(b('PENDING'), 'cancel', 'stranger', today)).toThrow(/not found/i);
  });

  it('cannot accept an already accepted or expired request', () => {
    expect(() => nextStatus(b('ACCEPTED'), 'accept', 'owner', today)).toThrow();
    expect(() => nextStatus(b('PENDING', { startDate: parseDateOnly('2026-06-09') }), 'accept', 'owner', today)).toThrow(/expired/);
  });

  it('allows renter or owner to cancel pending/accepted bookings only', () => {
    expect(nextStatus(b('PENDING'), 'cancel', 'renter', today)).toBe('CANCELLED');
    expect(nextStatus(b('ACCEPTED'), 'cancel', 'owner', today)).toBe('CANCELLED');
    expect(() => nextStatus(b('ACTIVE'), 'cancel', 'renter', today)).toThrow();
    expect(() => nextStatus(b('COMPLETED'), 'cancel', 'owner', today)).toThrow();
  });

  it('starts only on or after the start date, then completes', () => {
    expect(() => nextStatus(b('ACCEPTED'), 'start', 'owner', today)).toThrow(/not started/);
    expect(nextStatus(b('ACCEPTED'), 'start', 'owner', parseDateOnly('2026-06-12'))).toBe('ACTIVE');
    expect(nextStatus(b('ACTIVE'), 'complete', 'owner', today)).toBe('COMPLETED');
    expect(() => nextStatus(b('ACCEPTED'), 'complete', 'owner', today)).toThrow();
    expect(() => nextStatus(b('ACTIVE'), 'complete', 'renter', today)).toThrow();
  });

  it('allows simulated payment only by the renter after acceptance', () => {
    expect(nextStatus(b('ACCEPTED'), 'simulate_payment', 'renter', today)).toBe('ACCEPTED');
    expect(() => nextStatus(b('PENDING'), 'simulate_payment', 'renter', today)).toThrow();
    expect(() => nextStatus(b('ACCEPTED'), 'simulate_payment', 'owner', today)).toThrow();
    expect(() => nextStatus(b('ACCEPTED', { paymentStatus: 'SIMULATED_PAID' }), 'simulate_payment', 'renter', today)).toThrow();
  });
});
