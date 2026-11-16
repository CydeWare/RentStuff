import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  HandCoins,
  MapPin,
  PackageCheck,
  ReceiptText,
  Search,
  ShieldCheck,
  Star,
  Truck,
  Undo2,
} from 'lucide-react';
import { listingApi } from '@/services/endpoints';
import { useCategories } from '@/hooks/useMeta';
import { usePreferences } from '@/store/preferences';
import { CategoryIcon, LocationSelect } from '@/components/common';
import { ListingCard, ListingCardSkeleton, ListingGrid } from '@/components/ListingCard';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/form-controls';
import { Skeleton } from '@/components/ui/misc';
import type { ListingCard as ListingCardType } from '@/types';

const unsplash = (id: string, w = 800) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

function HeroSearch() {
  const navigate = useNavigate();
  const { city, setCity } = usePreferences();
  const { data: categories = [] } = useCategories();
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const params = new URLSearchParams();
        if (q.trim()) params.set('q', q.trim());
        if (city) params.set('city', city);
        if (category) params.set('category', category);
        navigate(`/explore?${params.toString()}`);
      }}
      className="mt-8 grid gap-2 rounded-2xl border border-line bg-white p-2 shadow-lift sm:grid-cols-[1fr_1fr_auto]"
    >
      <label className="relative flex items-center sm:col-span-3">
        <Search className="pointer-events-none absolute left-3.5 size-5 text-stone-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="What do you need?"
          aria-label="What do you need?"
          className="h-12 w-full rounded-xl pl-11 pr-3 text-[15px] focus:outline-none focus:ring-3 focus:ring-brand-100"
        />
      </label>
      <LocationSelect value={city} onChange={setCity} allLabel="Anywhere" className="h-12 border-0 bg-stone-50" />
      <Select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category" className="h-12 border-0 bg-stone-50">
        <option value="">All categories</option>
        {categories.map((c) => (
          <option key={c.id} value={c.slug}>
            {c.name}
          </option>
        ))}
      </Select>
      <Button type="submit" size="lg" className="h-12">
        <Search /> Search
      </Button>
    </form>
  );
}

function HeroVisual() {
  return (
    <div className="relative mx-auto hidden aspect-square w-full max-w-[520px] lg:block" aria-hidden>
      <div className="absolute right-0 top-0 h-[62%] w-[62%] overflow-hidden rounded-[28px] shadow-lift">
        <img src={unsplash('1502920917128-1aa500764cbd')} alt="" className="size-full object-cover" />
      </div>
      <div className="absolute bottom-0 left-0 h-[58%] w-[56%] overflow-hidden rounded-[28px] shadow-lift">
        <img src={unsplash('1504280390367-361c6d9f38f4')} alt="" className="size-full object-cover" />
      </div>
      <div className="absolute bottom-[6%] right-[4%] h-[30%] w-[34%] overflow-hidden rounded-[22px] shadow-lift">
        <img src={unsplash('1608043152269-423dbba4e7e1', 500)} alt="" className="size-full object-cover" />
      </div>
      <div className="absolute left-[2%] top-[14%] rounded-2xl border border-line bg-white px-4 py-3 shadow-lift">
        <p className="text-xs text-muted">Canon EOS · Kebayoran Baru</p>
        <p className="font-extrabold">
          Rp120.000<span className="text-sm font-medium text-muted">/day</span>
        </p>
        <p className="mt-1 flex items-center gap-1 text-xs font-semibold">
          <Star className="size-3.5 fill-accent-400 text-accent-400" /> 5.0 · 2 reviews
        </p>
      </div>
      <div className="absolute right-[38%] top-[52%] flex items-center gap-2 rounded-2xl bg-brand-700 px-4 py-3 text-white shadow-lift">
        <CheckCircle2 className="size-5" />
        <div>
          <p className="text-sm font-bold">Booking accepted</p>
          <p className="text-xs text-brand-100">Sat – Mon · Tent for 4</p>
        </div>
      </div>
    </div>
  );
}

function Section({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="container-page mt-20">
      <div className="mb-7 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h2>
          {subtitle && <p className="mt-1.5 text-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function ListingRow({ items, loading }: { items?: ListingCardType[]; loading: boolean }) {
  if (loading) {
    return (
      <ListingGrid>
        {Array.from({ length: 4 }).map((_, i) => (
          <ListingCardSkeleton key={i} />
        ))}
      </ListingGrid>
    );
  }
  if (!items?.length) return <p className="rounded-2xl bg-white p-8 text-center text-muted">No items here yet. Check back soon!</p>;
  return (
    <ListingGrid>
      {items.map((l) => (
        <ListingCard key={l.id} listing={l} />
      ))}
    </ListingGrid>
  );
}

const STEPS = [
  { icon: Search, title: 'Find an item', text: 'Browse items listed by people near you.' },
  { icon: CalendarDays, title: 'Choose your dates', text: 'See availability and the full price before you ask.' },
  { icon: ReceiptText, title: 'Request a booking', text: 'The owner reviews your request and accepts it.' },
  { icon: Truck, title: 'Pick up or get delivery', text: 'Meet the owner nearby, or have it delivered.' },
  { icon: Undo2, title: 'Return the item', text: 'Return on time and get your deposit back.' },
];

const TRUST = [
  { icon: BadgeCheck, title: 'Verified profiles', text: 'Every member registers with a phone number. Contact details are shared only after a booking is accepted.' },
  { icon: Star, title: 'Reviews and ratings', text: 'Only renters who completed a rental can leave a review, so ratings reflect real experiences.' },
  { icon: ReceiptText, title: 'Transparent prices', text: 'Rental fees, delivery and the refundable deposit are shown separately before you request.' },
  { icon: ShieldCheck, title: 'Secure booking', text: 'Dates are reserved only when the owner accepts, and double bookings are prevented automatically.' },
];

export function HomePage() {
  const { city } = usePreferences();
  const { data: categories, isLoading: catsLoading } = useCategories();
  // City or province chosen in the location selector (persisted); empty = everywhere.
  const nearCity = city || undefined;

  const near = useQuery({ queryKey: ['listings', 'featured', 'popular', nearCity], queryFn: () => listingApi.featured('popular', nearCity, 8) });
  const recent = useQuery({ queryKey: ['listings', 'featured', 'recent'], queryFn: () => listingApi.featured('recent', undefined, 4) });
  const recommended = useQuery({ queryKey: ['listings', 'featured', 'recommended'], queryFn: () => listingApi.featured('recommended', undefined, 4) });

  const nearItems = near.data?.items;
  const showFallback = nearCity && nearItems && nearItems.length === 0;
  const fallback = useQuery({
    queryKey: ['listings', 'featured', 'popular', undefined],
    queryFn: () => listingApi.featured('popular', undefined, 8),
    enabled: Boolean(showFallback),
  });

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-line bg-gradient-to-b from-brand-50/70 to-canvas">
        <div className="container-page grid items-center gap-12 py-14 lg:grid-cols-[1.15fr_1fr] lg:py-20">
          <div className="animate-fade-in">
            <p className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-3 py-1 text-xs font-semibold text-brand-800">
              <MapPin className="size-3.5" /> Now in Jakarta & Jabodetabek
            </p>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl xl:text-[3.4rem]">
              Rent what you need.
              <br />
              <span className="text-brand-700">Earn from what you own.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
              Why buy something you only need for a weekend? Borrow cameras, camping gear, tools and more from people nearby, or earn extra
              income from the things you rarely use.
            </p>
            <HeroSearch />
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-brand-600" /> Clear prices in Rupiah
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-brand-600" /> Refundable deposits
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-brand-600" /> Pickup or delivery
              </span>
            </div>
          </div>
          <HeroVisual />
        </div>
      </section>

      {/* Categories */}
      <Section title="Popular categories" subtitle="Everything you need, without buying it.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {catsLoading
            ? Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-32" />)
            : categories?.map((c) => (
                <Link
                  key={c.id}
                  to={`/explore?category=${c.slug}`}
                  className="group flex flex-col items-start rounded-2xl border border-line bg-white p-4 shadow-card transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lift"
                >
                  <span className="flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700 transition-colors group-hover:bg-brand-700 group-hover:text-white">
                    <CategoryIcon name={c.icon} className="size-5" />
                  </span>
                  <span className="mt-4 font-bold leading-tight">{c.name}</span>
                  <span className="mt-0.5 text-xs text-muted">{c.listingCount} items</span>
                </Link>
              ))}
        </div>
      </Section>

      <Section
        title={nearCity ? `Popular near ${nearCity}` : 'Popular items near you'}
        subtitle={showFallback ? `No items in ${nearCity} yet — here are popular items across the region.` : 'Most-booked items from owners in your area.'}
        action={
          <Button variant="outline" asChild className="hidden sm:inline-flex">
            <Link to={`/explore${city ? `?city=${encodeURIComponent(city)}` : ''}`}>
              View all <ArrowRight />
            </Link>
          </Button>
        }
      >
        <ListingRow items={showFallback ? fallback.data?.items : nearItems} loading={near.isLoading || (Boolean(showFallback) && fallback.isLoading)} />
      </Section>

      {/* How it works */}
      <section className="container-page mt-24">
        <div className="rounded-[28px] bg-white px-6 py-12 shadow-card sm:px-10">
          <h2 className="text-center text-2xl font-extrabold tracking-tight sm:text-3xl">How renting works</h2>
          <p className="mx-auto mt-2 max-w-lg text-center text-muted">From search to return in five simple steps.</p>
          <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative text-center">
                <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                  <s.icon className="size-6" />
                </span>
                <span className="mt-4 block text-xs font-bold text-brand-700">STEP {i + 1}</span>
                <h3 className="mt-1 font-bold">{s.title}</h3>
                <p className="mt-1 text-sm text-muted">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <Section title="Recently added" subtitle="Fresh listings from the community.">
        <ListingRow items={recent.data?.items} loading={recent.isLoading} />
      </Section>

      <Section title="Recommended for you" subtitle="Top-rated items with great reviews.">
        <ListingRow items={recommended.data?.items} loading={recommended.isLoading} />
      </Section>

      {/* Become an owner */}
      <section className="container-page mt-24">
        <div className="grid overflow-hidden rounded-[28px] bg-brand-800 text-white lg:grid-cols-2">
          <div className="p-8 sm:p-12">
            <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-white/10">
              <HandCoins className="size-6" />
            </span>
            <h2 className="mt-6 text-3xl font-extrabold tracking-tight">Turn unused items into extra income</h2>
            <p className="mt-3 max-w-md text-brand-100">
              That camera in the drawer or the tent in the storeroom could pay for itself. List it for free, set your own price and deposit, and
              approve every request yourself.
            </p>
            <ul className="mt-6 space-y-2 text-sm">
              {['Free to list — no subscription', 'You choose who rents and when', 'Security deposit protects your item'].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <PackageCheck className="size-4 text-accent-400" /> {t}
                </li>
              ))}
            </ul>
            <Button asChild size="lg" className="mt-8 bg-white text-brand-800 hover:bg-brand-50">
              <Link to="/listings/new">
                Start listing <ArrowRight />
              </Link>
            </Button>
          </div>
          <div className="relative hidden min-h-80 lg:block">
            <img src={unsplash('1504148455328-c376907d081c', 1000)} alt="A cordless drill ready to rent" className="absolute inset-0 size-full object-cover" />
            <div className="absolute bottom-8 left-8 rounded-2xl bg-white px-5 py-4 text-ink shadow-lift">
              <p className="text-xs text-muted">Example: drill rented 4 days a month</p>
              <p className="text-2xl font-extrabold">Rp160.000</p>
              <p className="text-xs text-muted">extra income every month</p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust and safety */}
      <Section title="Built on trust" subtitle="Renting from strangers should feel safe. Here's how we help.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST.map((t) => (
            <div key={t.title} className="rounded-2xl border border-line bg-white p-6 shadow-card">
              <t.icon className="size-7 text-brand-700" />
              <h3 className="mt-4 font-bold">{t.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{t.text}</p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
