import { Link } from 'react-router';
import { Heart, MapPin, Truck } from 'lucide-react';
import type { ListingCard as ListingCardType } from '@/types';
import { cn } from '@/utils/cn';
import { formatDate, formatIDR } from '@/utils/format';
import { useFavoriteToggle } from '@/hooks/useFavorite';
import { useAuth } from '@/hooks/useAuth';
import { Badge, Rating, SafeImage, Skeleton, UserAvatar } from './ui/misc';

export function ListingCard({ listing, className }: { listing: ListingCardType; className?: string }) {
  const { toggle, pending } = useFavoriteToggle();
  const { user } = useAuth();
  const isOwn = user?.id === listing.owner.id;

  return (
    <article className={cn('group relative flex flex-col', className)}>
      <Link to={`/items/${listing.id}`} className="block overflow-hidden rounded-2xl bg-stone-100">
        <div className="relative aspect-[4/3]">
          <SafeImage src={listing.image} alt={listing.title} className="size-full transition-transform duration-500 group-hover:scale-[1.03]" />
          <div className="absolute left-3 top-3 flex gap-1.5">
            {listing.availableToday ? (
              <Badge tone="dark">Available now</Badge>
            ) : (
              <Badge tone="dark">From {formatDate(listing.availableFrom!, 'd MMM')}</Badge>
            )}
          </div>
        </div>
      </Link>
      {!isOwn && (
        <button
          type="button"
          onClick={() => toggle(listing.id, listing.isFavorited)}
          disabled={pending}
          aria-label={listing.isFavorited ? 'Remove from favorites' : 'Save to favorites'}
          aria-pressed={listing.isFavorited}
          className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur transition hover:scale-105"
        >
          <Heart className={cn('size-[18px]', listing.isFavorited ? 'fill-red-500 text-red-500' : 'text-ink')} />
        </button>
      )}
      <div className="mt-3 flex flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">{listing.category.name}</p>
          <Rating value={listing.ratingAvg} count={listing.reviewCount} />
        </div>
        <Link to={`/items/${listing.id}`} className="mt-1 line-clamp-2 font-bold leading-snug hover:text-brand-800">
          {listing.title}
        </Link>
        <p className="mt-1 flex items-center gap-1 text-sm text-muted">
          <MapPin className="size-3.5 shrink-0" />
          <span className="truncate">{[listing.district, listing.city].filter(Boolean).join(', ')}</span>
          {listing.deliveryAvailable && (
            <span className="ml-1 inline-flex items-center gap-0.5 text-xs text-brand-700" title="Delivery available">
              <Truck className="size-3.5" />
            </span>
          )}
        </p>
        <div className="mt-auto flex items-center justify-between pt-3">
          <p>
            <span className="text-lg font-extrabold">{formatIDR(listing.dailyPrice)}</span>
            <span className="text-sm text-muted"> /day</span>
          </p>
          <Link to={`/users/${listing.owner.id}`} className="flex items-center gap-1.5 text-xs text-muted hover:text-ink" title={listing.owner.name}>
            <UserAvatar name={listing.owner.name} src={listing.owner.profileImage} className="size-6" />
            <span className="hidden max-w-20 truncate sm:inline">{listing.owner.name.split(' ')[0]}</span>
          </Link>
        </div>
      </div>
    </article>
  );
}

export function ListingCardSkeleton() {
  return (
    <div>
      <Skeleton className="aspect-[4/3] rounded-2xl" />
      <Skeleton className="mt-3 h-3 w-1/3" />
      <Skeleton className="mt-2 h-4 w-4/5" />
      <Skeleton className="mt-2 h-3 w-1/2" />
      <Skeleton className="mt-4 h-5 w-1/3" />
    </div>
  );
}

export function ListingGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4', className)}>{children}</div>;
}
