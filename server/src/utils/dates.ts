/**
 * Rental dates are calendar dates (no time component). They are exchanged as
 * "YYYY-MM-DD" strings and stored as UTC-midnight Date objects in DATE columns.
 * Both startDate and endDate are inclusive: renting 1–3 June is 3 rental days.
 */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Marketplace timezone used to decide what "today" is. */
export const MARKET_TIMEZONE = 'Asia/Jakarta';

export function isValidDateString(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function parseDateOnly(value: string): Date {
  if (!isValidDateString(value)) throw new Error(`Invalid date: ${value}`);
  return new Date(`${value}T00:00:00.000Z`);
}

export function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Today's date in the marketplace timezone, as a UTC-midnight Date. */
export function todayInMarket(now: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: MARKET_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now); // en-CA formats as YYYY-MM-DD
  return parseDateOnly(parts);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/** Number of rental days for an inclusive date range. */
export function inclusiveDayCount(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;
}

/** True when two inclusive date ranges share at least one day. */
export function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() <= bEnd.getTime() && bStart.getTime() <= aEnd.getTime();
}

export const MAX_ADVANCE_BOOKING_DAYS = 365;

export interface RangeValidationOptions {
  minDays?: number;
  maxDays?: number | null;
  today?: Date;
}

/**
 * Validates a requested rental range. Returns an error message, or null when valid.
 */
export function validateRentalRange(
  startStr: string,
  endStr: string,
  { minDays = 1, maxDays = null, today = todayInMarket() }: RangeValidationOptions = {},
): string | null {
  if (!isValidDateString(startStr) || !isValidDateString(endStr)) return 'Dates must be valid dates (YYYY-MM-DD)';
  const start = parseDateOnly(startStr);
  const end = parseDateOnly(endStr);
  if (end < start) return 'End date must be on or after the start date';
  if (start < today) return 'Start date cannot be in the past';
  if (start > addDays(today, MAX_ADVANCE_BOOKING_DAYS)) return 'Bookings can be made at most 1 year in advance';
  const days = inclusiveDayCount(start, end);
  if (days < minDays) return `Minimum rental period for this item is ${minDays} day${minDays > 1 ? 's' : ''}`;
  if (maxDays != null && days > maxDays) return `Maximum rental period for this item is ${maxDays} days`;
  return null;
}
