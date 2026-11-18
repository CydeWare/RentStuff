import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { PackageSearch, Search, SlidersHorizontal, X } from 'lucide-react';
import { listingApi, type SearchParams } from '@/services/endpoints';
import { errorMessage } from '@/services/api';
import { useCategories } from '@/hooks/useMeta';
import { usePreferences } from '@/store/preferences';
import { ListingCard, ListingCardSkeleton, ListingGrid } from '@/components/ListingCard';
import { LocationSelect } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input, Select, Switch } from '@/components/ui/form-controls';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { EmptyState, ErrorState, Pagination } from '@/components/ui/misc';
import { CONDITION_LABELS, toDateString } from '@/utils/format';
import type { ItemCondition } from '@/types';

const SORTS = [
  { value: 'relevance', label: 'Most relevant' },
  { value: 'price_asc', label: 'Lowest price' },
  { value: 'price_desc', label: 'Highest price' },
  { value: 'rating', label: 'Highest rating' },
  { value: 'newest', label: 'Newest listings' },
];

const DURATIONS = [1, 2, 3, 5, 7, 14, 30];
const FILTER_KEYS = ['category', 'city', 'minPrice', 'maxPrice', 'condition', 'startDate', 'duration', 'delivery'] as const;

function numberParam(v: string | null) {
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function Filters({ params, update }: { params: URLSearchParams; update: (patch: Record<string, string | null>) => void }) {
  const { data: categories = [] } = useCategories();
  const { setCity } = usePreferences();
  const conditions = (params.get('condition') ?? '').split(',').filter(Boolean);
  const [minPrice, setMinPrice] = useState(params.get('minPrice') ?? '');
  const [maxPrice, setMaxPrice] = useState(params.get('maxPrice') ?? '');

  useEffect(() => {
    setMinPrice(params.get('minPrice') ?? '');
    setMaxPrice(params.get('maxPrice') ?? '');
  }, [params]);

  const toggleCondition = (c: ItemCondition) => {
    const next = conditions.includes(c) ? conditions.filter((x) => x !== c) : [...conditions, c];
    update({ condition: next.length ? next.join(',') : null });
  };

  const priceInvalid = minPrice !== '' && maxPrice !== '' && Number(minPrice) > Number(maxPrice);

  return (
    <div className="space-y-6">
      <Field label="Location" htmlFor="f-city">
        <LocationSelect
          id="f-city"
          value={params.get('city') ?? ''}
          onChange={(v) => {
            setCity(v);
            update({ city: v || null });
          }}
        />
      </Field>
      <Field label="Category" htmlFor="f-cat">
        <Select id="f-cat" value={params.get('category') ?? ''} onChange={(e) => update({ category: e.target.value || null })}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name} ({c.listingCount})
            </option>
          ))}
        </Select>
      </Field>
      <div>
        <p className="mb-1.5 text-sm font-semibold">Daily price (Rp)</p>
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!priceInvalid) update({ minPrice: minPrice || null, maxPrice: maxPrice || null });
          }}
          onBlur={() => {
            if (!priceInvalid) update({ minPrice: minPrice || null, maxPrice: maxPrice || null });
          }}
        >
          <Input type="number" min={0} step={5000} inputMode="numeric" placeholder="Min" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} aria-label="Minimum price" aria-invalid={priceInvalid} />
          <span className="text-muted">–</span>
          <Input type="number" min={0} step={5000} inputMode="numeric" placeholder="Max" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} aria-label="Maximum price" aria-invalid={priceInvalid} />
          <button type="submit" className="sr-only">
            Apply price
          </button>
        </form>
        {priceInvalid && <p className="mt-1 text-xs font-medium text-red-600">Minimum cannot be higher than maximum</p>}
      </div>
      <Field label="Available from" htmlFor="f-start" hint="Shows only items free for the whole period">
        <Input
          id="f-start"
          type="date"
          min={toDateString(new Date())}
          value={params.get('startDate') ?? ''}
          onChange={(e) => update({ startDate: e.target.value || null })}
        />
      </Field>
      <Field label="Rental duration" htmlFor="f-dur">
        <Select id="f-dur" value={params.get('duration') ?? ''} onChange={(e) => update({ duration: e.target.value || null })}>
          <option value="">Any duration</option>
          {DURATIONS.map((d) => (
            <option key={d} value={d}>
              {d === 1 ? '1 day' : d === 7 ? '1 week' : d === 14 ? '2 weeks' : d === 30 ? '1 month' : `${d} days`}
            </option>
          ))}
        </Select>
      </Field>
      <div>
        <p className="mb-2 text-sm font-semibold">Condition</p>
        <div className="space-y-2.5">
          {(Object.keys(CONDITION_LABELS) as ItemCondition[]).map((c) => (
            <label key={c} className="flex cursor-pointer items-center gap-2.5 text-sm">
              <Checkbox checked={conditions.includes(c)} onCheckedChange={() => toggleCondition(c)} />
              {CONDITION_LABELS[c]}
            </label>
          ))}
        </div>
      </div>
      <label className="flex cursor-pointer items-center justify-between gap-3 text-sm font-semibold">
        Delivery available
        <Switch checked={params.get('delivery') === 'true'} onCheckedChange={(v) => update({ delivery: v ? 'true' : null })} />
      </label>
    </div>
  );
}

export function ExplorePage() {
  const [params, setParams] = useSearchParams();
  const [mobileFilters, setMobileFilters] = useState(false);
  const [q, setQ] = useState(params.get('q') ?? '');

  useEffect(() => setQ(params.get('q') ?? ''), [params]);

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') next.delete(k);
      else next.set(k, v);
    }
    if (!('page' in patch)) next.delete('page');
    setParams(next);
  };

  const search: SearchParams = {
    q: params.get('q') ?? undefined,
    category: params.get('category') ?? undefined,
    city: params.get('city') ?? undefined,
    minPrice: numberParam(params.get('minPrice')),
    maxPrice: numberParam(params.get('maxPrice')),
    condition: params.get('condition') ?? undefined,
    startDate: params.get('startDate') ?? undefined,
    duration: numberParam(params.get('duration')),
    delivery: params.get('delivery') ?? undefined,
    sort: params.get('sort') ?? 'relevance',
    page: numberParam(params.get('page')) ?? 1,
    limit: 12,
  };

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['listings', 'search', search],
    queryFn: () => listingApi.search(search),
    placeholderData: keepPreviousData,
  });

  const activeFilters = FILTER_KEYS.filter((k) => params.get(k)).length;

  return (
    <div className="container-page py-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <form
          role="search"
          className="relative flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            update({ q: q.trim() || null });
          }}
        >
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-stone-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by item name or keyword"
            aria-label="Search items"
            className="h-12 w-full rounded-2xl border border-line bg-white pl-12 pr-28 text-[15px] shadow-card focus:border-brand-500 focus:outline-none focus:ring-3 focus:ring-brand-100"
          />
          <Button type="submit" className="absolute right-1.5 top-1.5 h-9">
            Search
          </Button>
        </form>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="h-12 lg:hidden" onClick={() => setMobileFilters(true)}>
            <SlidersHorizontal /> Filters {activeFilters > 0 && <span className="rounded-full bg-brand-700 px-1.5 text-xs text-white">{activeFilters}</span>}
          </Button>
          <Select value={search.sort} onChange={(e) => update({ sort: e.target.value })} className="h-12 min-w-48" aria-label="Sort by">
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                Sort: {s.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[260px_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-2xl border border-line bg-white p-5 shadow-card">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-bold">Filters</h2>
              {activeFilters > 0 && (
                <button className="text-xs font-semibold text-brand-700 hover:underline" onClick={() => update(Object.fromEntries(FILTER_KEYS.map((k) => [k, null])))}>
                  Clear all
                </button>
              )}
            </div>
            <Filters params={params} update={update} />
          </div>
        </aside>

        <div>
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <p className="text-sm text-muted">
              {isLoading ? 'Searching…' : `${data?.total ?? 0} item${data?.total === 1 ? '' : 's'} available`}
              {search.q && (
                <>
                  {' '}
                  for <span className="font-semibold text-ink">“{search.q}”</span>
                </>
              )}
            </p>
            {search.q && (
              <button className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold" onClick={() => update({ q: null })}>
                Clear search <X className="size-3" />
              </button>
            )}
          </div>

          {isError ? (
            <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />
          ) : isLoading ? (
            <ListingGrid className="xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <ListingCardSkeleton key={i} />
              ))}
            </ListingGrid>
          ) : data && data.items.length === 0 ? (
            <EmptyState
              icon={PackageSearch}
              title="No items match your search"
              description="Try a different keyword, widen the price range or choose another location."
              action={
                <Button variant="outline" onClick={() => setParams(new URLSearchParams())}>
                  Reset all filters
                </Button>
              }
            />
          ) : (
            <div className={isFetching ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
              <ListingGrid className="xl:grid-cols-3">
                {data?.items.map((l) => (
                  <ListingCard key={l.id} listing={l} />
                ))}
              </ListingGrid>
              <Pagination
                page={data?.page ?? 1}
                totalPages={data?.totalPages ?? 1}
                onChange={(p) => {
                  update({ page: String(p) });
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />
            </div>
          )}
        </div>
      </div>

      <Dialog open={mobileFilters} onOpenChange={setMobileFilters}>
        <DialogContent title="Filters">
          <Filters params={params} update={update} />
          <div className="mt-6 flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => update(Object.fromEntries(FILTER_KEYS.map((k) => [k, null])))}>
              Clear all
            </Button>
            <Button className="flex-1" onClick={() => setMobileFilters(false)}>
              Show {data?.total ?? ''} results
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
