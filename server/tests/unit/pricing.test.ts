import { describe, expect, it } from 'vitest';
import { calculatePrice, calculateRentalSubtotal } from '../../src/utils/pricing.js';

describe('calculatePrice', () => {
  it('matches the spec example: 3 days at Rp100.000 with delivery and deposit', () => {
    const p = calculatePrice({
      dailyPrice: 100_000,
      securityDeposit: 200_000,
      deliveryFee: 20_000,
      rentalDays: 3,
      delivery: true,
    });
    expect(p.rentalSubtotal).toBe(300_000);
    expect(p.deliveryFee).toBe(20_000);
    expect(p.securityDeposit).toBe(200_000);
    expect(p.rentalTotal).toBe(320_000);
    expect(p.totalDue).toBe(520_000);
  });

  it('keeps the deposit separate from the rental fee', () => {
    const p = calculatePrice({ dailyPrice: 50_000, securityDeposit: 1_000_000, deliveryFee: 0, rentalDays: 2, delivery: false });
    expect(p.rentalSubtotal).toBe(100_000);
    expect(p.rentalTotal).toBe(100_000);
    expect(p.totalDue).toBe(1_100_000);
  });

  it('does not charge delivery for self pickup', () => {
    const p = calculatePrice({ dailyPrice: 50_000, securityDeposit: 0, deliveryFee: 30_000, rentalDays: 1, delivery: false });
    expect(p.deliveryFee).toBe(0);
    expect(p.totalDue).toBe(50_000);
  });
});

describe('calculateRentalSubtotal', () => {
  it('uses the daily rate when no weekly or monthly price exists', () => {
    expect(calculateRentalSubtotal(10, 10_000)).toBe(100_000);
  });

  it('applies the weekly rate for full weeks plus daily remainder', () => {
    // 9 days = 1 week (600k) + 2 days (200k)
    expect(calculateRentalSubtotal(9, 100_000, 600_000)).toBe(800_000);
  });

  it('uses a weekly rate for a partial week when that is cheaper', () => {
    // 6 days daily = 600k, one week = 500k -> 500k
    expect(calculateRentalSubtotal(6, 100_000, 500_000)).toBe(500_000);
  });

  it('applies the monthly rate', () => {
    // 31 days = 1 month (2M) + 1 day (100k)
    expect(calculateRentalSubtotal(31, 100_000, 600_000, 2_000_000)).toBe(2_100_000);
  });

  it('never exceeds paying the daily rate for every day', () => {
    for (let d = 1; d <= 60; d++) {
      expect(calculateRentalSubtotal(d, 100_000, 650_000, 2_500_000)).toBeLessThanOrEqual(d * 100_000);
    }
  });

  it('rejects non-positive durations', () => {
    expect(() => calculateRentalSubtotal(0, 100_000)).toThrow();
    expect(() => calculateRentalSubtotal(1.5, 100_000)).toThrow();
  });
});
