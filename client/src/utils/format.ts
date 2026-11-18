import { differenceInCalendarDays, format, formatDistanceToNowStrict, parseISO } from 'date-fns';
import type { BookingStatus, ItemCondition } from '@/types';

const rupiah = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

/** Rp100.000 (Indonesian formatting, no decimals). */
export function formatIDR(amount: number) {
  return rupiah.format(amount).replace(/\s/g, '');
}

/** Short form for compact UI: Rp1,5jt / Rp150rb */
export function formatIDRShort(amount: number) {
  if (amount >= 1_000_000) return `Rp${(amount / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })}jt`;
  if (amount >= 1_000) return `Rp${Math.round(amount / 1000)}rb`;
  return formatIDR(amount);
}

/** Parses a YYYY-MM-DD string as a local date (no timezone shift). */
export function parseDate(value: string) {
  return parseISO(value);
}

export function toDateString(d: Date) {
  return format(d, 'yyyy-MM-dd');
}

export function formatDate(value: string | Date, pattern = 'd MMM yyyy') {
  return format(typeof value === 'string' ? parseISO(value) : value, pattern);
}

export function formatDateRange(start: string, end: string) {
  const s = parseISO(start);
  const e = parseISO(end);
  if (start === end) return format(s, 'EEE, d MMM yyyy');
  if (s.getFullYear() === e.getFullYear()) return `${format(s, 'd MMM')} – ${format(e, 'd MMM yyyy')}`;
  return `${format(s, 'd MMM yyyy')} – ${format(e, 'd MMM yyyy')}`;
}

export function inclusiveDays(start: string, end: string) {
  return differenceInCalendarDays(parseISO(end), parseISO(start)) + 1;
}

export function timeAgo(value: string) {
  return formatDistanceToNowStrict(new Date(value), { addSuffix: true });
}

export function formatTime(value: string) {
  return format(new Date(value), 'HH:mm');
}

export const CONDITION_LABELS: Record<ItemCondition, string> = {
  BRAND_NEW: 'Brand New',
  LIKE_NEW: 'Like New',
  GOOD: 'Good',
  FAIR: 'Fair',
};

export const CONDITION_HINTS: Record<ItemCondition, string> = {
  BRAND_NEW: 'Unused, in original packaging',
  LIKE_NEW: 'Barely used, no visible wear',
  GOOD: 'Normal signs of use, fully working',
  FAIR: 'Visible wear, fully working',
};

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  REJECTED: 'Declined',
  CANCELLED: 'Cancelled',
  ACTIVE: 'Active',
  COMPLETED: 'Completed',
};

export const REPORT_REASONS: Record<string, string> = {
  PROHIBITED_ITEM: 'Prohibited or dangerous item',
  MISLEADING: 'Misleading photos or description',
  SCAM: 'Suspected scam or fraud',
  OFFENSIVE: 'Offensive content',
  DUPLICATE: 'Duplicate listing',
  OTHER: 'Something else',
};

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}
