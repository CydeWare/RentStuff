import { describe, expect, it } from 'vitest';
import {
  inclusiveDayCount,
  isValidDateString,
  parseDateOnly,
  rangesOverlap,
  todayInMarket,
  validateRentalRange,
} from '../../src/utils/dates.js';

const today = parseDateOnly('2026-06-10');
const d = parseDateOnly;

describe('date helpers', () => {
  it('validates YYYY-MM-DD strings, including impossible dates', () => {
    expect(isValidDateString('2026-06-10')).toBe(true);
    expect(isValidDateString('2026-02-30')).toBe(false);
    expect(isValidDateString('10-06-2026')).toBe(false);
    expect(isValidDateString('2026-6-1')).toBe(false);
  });

  it('counts rental days inclusively', () => {
    expect(inclusiveDayCount(d('2026-06-01'), d('2026-06-01'))).toBe(1);
    expect(inclusiveDayCount(d('2026-06-01'), d('2026-06-03'))).toBe(3);
  });

  it('detects overlapping inclusive ranges', () => {
    expect(rangesOverlap(d('2026-06-01'), d('2026-06-03'), d('2026-06-03'), d('2026-06-05'))).toBe(true);
    expect(rangesOverlap(d('2026-06-01'), d('2026-06-03'), d('2026-06-04'), d('2026-06-05'))).toBe(false);
    expect(rangesOverlap(d('2026-06-02'), d('2026-06-02'), d('2026-06-01'), d('2026-06-05'))).toBe(true);
  });

  it('computes today in Jakarta time (UTC+7)', () => {
    // 20:00 UTC on 9 June is 03:00 on 10 June in Jakarta
    expect(todayInMarket(new Date('2026-06-09T20:00:00Z')).toISOString().slice(0, 10)).toBe('2026-06-10');
  });
});

describe('validateRentalRange', () => {
  it('accepts a valid future range', () => {
    expect(validateRentalRange('2026-06-10', '2026-06-12', { today })).toBeNull();
  });
  it('rejects end before start', () => {
    expect(validateRentalRange('2026-06-12', '2026-06-10', { today })).toMatch(/End date/);
  });
  it('rejects past start dates', () => {
    expect(validateRentalRange('2026-06-09', '2026-06-12', { today })).toMatch(/past/);
  });
  it('enforces minimum and maximum rental days', () => {
    expect(validateRentalRange('2026-06-10', '2026-06-10', { today, minDays: 2 })).toMatch(/Minimum/);
    expect(validateRentalRange('2026-06-10', '2026-06-20', { today, maxDays: 7 })).toMatch(/Maximum/);
  });
  it('rejects bookings more than a year ahead', () => {
    expect(validateRentalRange('2027-07-01', '2027-07-02', { today })).toMatch(/1 year/);
  });
  it('rejects malformed dates', () => {
    expect(validateRentalRange('nope', '2026-06-12', { today })).toMatch(/valid/);
  });
});
