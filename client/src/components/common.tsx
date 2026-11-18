import { Link } from 'react-router';
import {
  Bike,
  Laptop,
  Package,
  PartyPopper,
  Sofa,
  Tent,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { BRAND } from '@/config/brand';
import { cn } from '@/utils/cn';
import { Badge } from './ui/misc';
import { BOOKING_STATUS_LABELS, formatIDR } from '@/utils/format';
import type { BookingStatus, PaymentStatus, PriceBreakdown } from '@/types';
import { useLocations } from '@/hooks/useMeta';
import { Select } from './ui/form-controls';

export function Logo({ className, light }: { className?: string; light?: boolean }) {
  return (
    <Link to="/" className={cn('group inline-flex items-center gap-2', className)} aria-label={`${BRAND.name} home`}>
      <span className="relative flex size-9 items-center justify-center rounded-xl bg-brand-700 text-lg font-extrabold text-white shadow-sm">
        {BRAND.name[0]}
        <span className="absolute bottom-1.5 right-1.5 size-1.5 rounded-full bg-accent-400" />
      </span>
      <span className={cn('text-xl font-extrabold tracking-tight', light ? 'text-white' : 'text-ink')}>{BRAND.name.toLowerCase()}</span>
    </Link>
  );
}

const CATEGORY_ICONS: Record<string, LucideIcon> = { Laptop, Tent, Sofa, Wrench, PartyPopper, Bike, Package };

export function CategoryIcon({ name, className }: { name: string; className?: string }) {
  const Icon = CATEGORY_ICONS[name] ?? Package;
  return <Icon className={className} />;
}

const STATUS_TONES: Record<BookingStatus, 'amber' | 'green' | 'red' | 'neutral' | 'blue' | 'brand'> = {
  PENDING: 'amber',
  ACCEPTED: 'blue',
  ACTIVE: 'green',
  COMPLETED: 'brand',
  REJECTED: 'red',
  CANCELLED: 'neutral',
};

export function BookingStatusBadge({ status, expired }: { status: BookingStatus; expired?: boolean }) {
  if (expired) return <Badge tone="neutral">Expired</Badge>;
  return <Badge tone={STATUS_TONES[status]}>{BOOKING_STATUS_LABELS[status]}</Badge>;
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  if (status === 'SIMULATED_PAID') return <Badge tone="green" title="Test mode: no real money was moved">Paid (simulated)</Badge>;
  if (status === 'SIMULATED_REFUNDED') return <Badge tone="neutral" title="Test mode: no real money was moved">Refunded (simulated)</Badge>;
  return <Badge tone="neutral">Unpaid</Badge>;
}

/** Price breakdown that always separates the refundable deposit from rental fees. */
export function PriceBreakdownView({
  breakdown,
  className,
}: {
  breakdown: Pick<PriceBreakdown, 'rentalDays' | 'dailyPrice' | 'rentalSubtotal' | 'discount' | 'deliveryFee' | 'securityDeposit' | 'totalDue'>;
  className?: string;
}) {
  const b = breakdown;
  return (
    <dl className={cn('space-y-2 text-sm', className)}>
      <div className="flex justify-between">
        <dt className="text-muted">
          {formatIDR(b.dailyPrice)} × {b.rentalDays} day{b.rentalDays > 1 ? 's' : ''}
        </dt>
        <dd>{formatIDR(b.dailyPrice * b.rentalDays)}</dd>
      </div>
      {b.discount > 0 && (
        <div className="flex justify-between text-emerald-700">
          <dt>Weekly / monthly rate savings</dt>
          <dd>−{formatIDR(b.discount)}</dd>
        </div>
      )}
      <div className="flex justify-between font-semibold">
        <dt>Rental subtotal</dt>
        <dd>{formatIDR(b.rentalSubtotal)}</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-muted">Delivery fee</dt>
        <dd>{b.deliveryFee ? formatIDR(b.deliveryFee) : 'Free (self pickup)'}</dd>
      </div>
      <div className="flex justify-between rounded-xl bg-brand-50 px-3 py-2 text-brand-900">
        <dt>
          Security deposit <span className="text-xs font-semibold">(refundable)</span>
        </dt>
        <dd className="font-semibold">{formatIDR(b.securityDeposit)}</dd>
      </div>
      <div className="flex justify-between border-t border-line pt-3 text-base font-extrabold">
        <dt>Total amount required</dt>
        <dd>{formatIDR(b.totalDue)}</dd>
      </div>
      <p className="text-xs text-muted">
        Non-refundable rental cost: {formatIDR(b.rentalSubtotal + b.deliveryFee)}. The deposit is returned after the item comes back in the
        same condition.
      </p>
    </dl>
  );
}

/** City selector grouped by province. Province values select every city in that province. */
export function LocationSelect({
  value,
  onChange,
  allLabel = 'All locations',
  includeProvinces = true,
  className,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  allLabel?: string;
  includeProvinces?: boolean;
  className?: string;
  id?: string;
}) {
  const { data: provinces = [] } = useLocations();
  return (
    <Select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={className} aria-label="Location">
      <option value="">{allLabel}</option>
      {provinces.map((p) => (
        <optgroup key={p.name} label={p.name}>
          {includeProvinces && <option value={p.name}>All of {p.name}</option>}
          {p.cities.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name}
            </option>
          ))}
        </optgroup>
      ))}
    </Select>
  );
}
