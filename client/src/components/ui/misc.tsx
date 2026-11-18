import * as React from 'react';
import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2, Star } from 'lucide-react';
import { cn } from '@/utils/cn';
import { initials } from '@/utils/format';

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-2xl border border-line bg-white shadow-card', className)} {...props} />;
}

const badgeVariants = cva('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap', {
  variants: {
    tone: {
      neutral: 'bg-stone-100 text-stone-700',
      brand: 'bg-brand-50 text-brand-800',
      green: 'bg-emerald-50 text-emerald-700',
      amber: 'bg-amber-50 text-amber-800',
      red: 'bg-red-50 text-red-700',
      blue: 'bg-sky-50 text-sky-800',
      dark: 'bg-ink/80 text-white backdrop-blur',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

export function Badge({ className, tone, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-xl bg-stone-200/70', className)} {...props} />;
}

export function Spinner({ className, label = 'Loading' }: { className?: string; label?: string }) {
  return (
    <div className={cn('flex items-center justify-center py-16 text-muted', className)} role="status" aria-label={label}>
      <Loader2 className="size-6 animate-spin text-brand-600" />
    </div>
  );
}

export function UserAvatar({
  name,
  src,
  className,
}: {
  name: string;
  src?: string | null;
  className?: string;
}) {
  return (
    <AvatarPrimitive.Root className={cn('relative inline-flex size-10 shrink-0 overflow-hidden rounded-full bg-brand-100', className)}>
      {src && <AvatarPrimitive.Image src={src} alt={name} className="size-full object-cover" />}
      <AvatarPrimitive.Fallback className="flex size-full items-center justify-center text-[0.8em] font-bold text-brand-800" delayMs={src ? 300 : 0}>
        {initials(name)}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}

export function Rating({ value, count, className, size = 'sm' }: { value: number; count?: number; className?: string; size?: 'sm' | 'md' }) {
  if (!count) {
    return <span className={cn('text-xs font-medium text-muted', className)}>New</span>;
  }
  return (
    <span className={cn('inline-flex items-center gap-1 font-semibold', size === 'sm' ? 'text-xs' : 'text-sm', className)}>
      <Star className={cn('fill-accent-400 text-accent-400', size === 'sm' ? 'size-3.5' : 'size-4')} />
      {value.toFixed(1)}
      {count != null && <span className="font-normal text-muted">({count})</span>}
    </span>
  );
}

export function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn('inline-flex gap-0.5', className)} aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn('size-3.5', n <= value ? 'fill-accent-400 text-accent-400' : 'text-stone-300')} />
      ))}
    </span>
  );
}

export function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = React.useState(0);
  const labels = ['Terrible', 'Poor', 'Okay', 'Good', 'Excellent'];
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(n)}
          className="rounded p-0.5"
        >
          <Star className={cn('size-7 transition-colors', (hover || value) >= n ? 'fill-accent-400 text-accent-400' : 'text-stone-300')} />
        </button>
      ))}
      <span className="ml-2 text-sm text-muted">{labels[(hover || value) - 1] ?? 'Select a rating'}</span>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-white px-6 py-14 text-center', className)}>
      <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
        <Icon className="size-6" />
      </div>
      <h3 className="text-base font-bold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-2xl border border-red-100 bg-red-50 px-6 py-10 text-center">
      <p className="font-semibold text-red-800">We couldn't load this</p>
      <p className="mt-1 text-sm text-red-700">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-4 text-sm font-semibold text-red-800 underline underline-offset-4">
          Try again
        </button>
      )}
    </div>
  );
}

/** Image with graceful fallback when the URL fails to load. */
export function SafeImage({ src, alt, className }: { src?: string | null; alt: string; className?: string }) {
  const [failed, setFailed] = React.useState(false);
  if (!src || failed) {
    return (
      <div className={cn('flex items-center justify-center bg-gradient-to-br from-stone-100 to-stone-200 text-stone-400', className)} aria-label={alt}>
        <svg viewBox="0 0 24 24" className="size-10" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <circle cx="9" cy="10" r="2" />
          <path d="m21 16-5-5-9 9" />
        </svg>
      </div>
    );
  }
  return <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className={cn('object-cover', className)} />;
}

export function PageHeader({ title, description, actions }: { title: string; description?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  const pages: (number | '...')[] = [];
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || Math.abs(p - page) <= 1) pages.push(p);
    else if (pages[pages.length - 1] !== '...') pages.push('...');
  }
  const btn = 'h-10 min-w-10 rounded-xl px-3 text-sm font-semibold transition-colors';
  return (
    <nav className="mt-10 flex items-center justify-center gap-1.5" aria-label="Pagination">
      <button className={cn(btn, 'border border-line bg-white disabled:opacity-40')} disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Previous
      </button>
      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`e${i}`} className="px-2 text-muted">
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            aria-current={p === page ? 'page' : undefined}
            className={cn(btn, p === page ? 'bg-brand-700 text-white' : 'hover:bg-stone-100')}
          >
            {p}
          </button>
        ),
      )}
      <button className={cn(btn, 'border border-line bg-white disabled:opacity-40')} disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
        Next
      </button>
    </nav>
  );
}
