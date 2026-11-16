import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useFieldArray, useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { CalendarX, ImagePlus, Loader2, Plus, Star, Trash2, X } from 'lucide-react';
import { listingApi, uploadApi, type ListingInput } from '@/services/endpoints';
import { ApiError, errorMessage } from '@/services/api';
import { useCategories, useLocations } from '@/hooks/useMeta';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Switch, Textarea } from '@/components/ui/form-controls';
import { Card, ErrorState, SafeImage, Spinner } from '@/components/ui/misc';
import { cn } from '@/utils/cn';
import { CONDITION_HINTS, CONDITION_LABELS, formatIDR, toDateString } from '@/utils/format';
import type { ItemCondition } from '@/types';

const SUBCATEGORY_SUGGESTIONS: Record<string, string[]> = {
  electronics: ['Laptops', 'Cameras', 'Monitors', 'Projectors', 'Tablets', 'Audio', 'Drones', 'Gaming'],
  'travel-outdoor': ['Camping', 'Bags', 'Luggage', 'Hiking'],
  household: ['Cleaning', 'Kitchen', 'Appliances'],
  tools: ['Power tools', 'Hand tools', 'Ladders', 'Garden'],
  events: ['Audio', 'Lighting', 'Decorations', 'Cameras', 'Furniture'],
  sports: ['Cycling', 'Racket sports', 'Fitness', 'Team sports', 'Water sports'],
  other: ['Musical instruments', 'Office equipment', 'Baby & kids'],
};

const MAX_IMAGES = 10;
const MAX_BYTES = 5 * 1024 * 1024;

const optionalInt = z.preprocess(
  (v) => (v === '' || v === null || v === undefined || Number.isNaN(v) ? null : Number(v)),
  z.number().int('Whole numbers only').positive('Must be greater than 0').nullable(),
);
const money = (label: string) =>
  z.preprocess((v) => (v === '' || Number.isNaN(v) ? undefined : Number(v)), z.number({ required_error: `${label} is required`, invalid_type_error: `${label} is required` }).int().min(0, `${label} cannot be negative`));

const schema = z
  .object({
    title: z.string().trim().min(5, 'Title must be at least 5 characters').max(100),
    description: z.string().trim().min(20, 'Describe the item in at least 20 characters').max(4000),
    categoryId: z.string().min(1, 'Choose a category'),
    subcategory: z.string().trim().max(60).optional(),
    dailyPrice: money('Daily price').pipe(z.number().min(1000, 'Daily price must be at least Rp1.000')),
    weeklyPrice: optionalInt,
    monthlyPrice: optionalInt,
    securityDeposit: money('Security deposit'),
    condition: z.enum(['BRAND_NEW', 'LIKE_NEW', 'GOOD', 'FAIR'], { errorMap: () => ({ message: 'Choose the item condition' }) }),
    province: z.string().min(1, 'Choose a province'),
    city: z.string().min(1, 'Choose a city'),
    district: z.string().optional(),
    address: z.string().trim().min(5, 'Describe where renters can pick up the item').max(300),
    pickupAvailable: z.boolean(),
    deliveryAvailable: z.boolean(),
    deliveryFee: z.preprocess((v) => (v === '' || Number.isNaN(v) ? 0 : Number(v)), z.number().int().min(0)),
    minRentalDays: z.preprocess((v) => (v === '' || Number.isNaN(v) ? 1 : Number(v)), z.number().int().min(1).max(365)),
    maxRentalDays: optionalInt,
    images: z.array(z.string()).min(1, 'Add at least one photo').max(MAX_IMAGES),
    blockedDates: z.array(z.object({ startDate: z.string().min(1, 'Start date required'), endDate: z.string().min(1, 'End date required'), note: z.string().optional() })),
  })
  .superRefine((v, ctx) => {
    if (!v.pickupAvailable && !v.deliveryAvailable) ctx.addIssue({ code: 'custom', path: ['pickupAvailable'], message: 'Offer pickup, delivery, or both' });
    if (v.weeklyPrice != null && v.weeklyPrice >= v.dailyPrice * 7) ctx.addIssue({ code: 'custom', path: ['weeklyPrice'], message: `Should be less than 7 × daily (${formatIDR(v.dailyPrice * 7)})` });
    if (v.monthlyPrice != null && v.monthlyPrice >= v.dailyPrice * 30) ctx.addIssue({ code: 'custom', path: ['monthlyPrice'], message: `Should be less than 30 × daily (${formatIDR(v.dailyPrice * 30)})` });
    if (v.maxRentalDays != null && v.maxRentalDays < v.minRentalDays) ctx.addIssue({ code: 'custom', path: ['maxRentalDays'], message: 'Must be at least the minimum' });
    v.blockedDates.forEach((b, i) => {
      if (b.startDate && b.endDate && b.endDate < b.startDate) ctx.addIssue({ code: 'custom', path: ['blockedDates', i, 'endDate'], message: 'End must be after start' });
    });
  });

type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

function ImageUploader({ value, onChange, error }: { value: string[]; onChange: (v: string[]) => void; error?: string }) {
  const [uploading, setUploading] = useState(0);

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files);
    const room = MAX_IMAGES - value.length;
    if (room <= 0) return toast.error(`You can add up to ${MAX_IMAGES} photos`);
    const accepted = list.slice(0, room).filter((f) => {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
        toast.error(`${f.name}: only JPG, PNG or WebP`);
        return false;
      }
      if (f.size > MAX_BYTES) {
        toast.error(`${f.name}: must be 5 MB or smaller`);
        return false;
      }
      return true;
    });
    if (!accepted.length) return;
    setUploading(accepted.length);
    try {
      const { urls } = await uploadApi.images(accepted);
      onChange([...value, ...urls]);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setUploading(0);
    }
  };

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {value.map((url, i) => (
          <div key={url} className="group relative aspect-square overflow-hidden rounded-xl border border-line bg-stone-100">
            <SafeImage src={url} alt={`Photo ${i + 1}`} className="size-full" />
            {i === 0 && <span className="absolute left-2 top-2 rounded-full bg-ink/75 px-2 py-0.5 text-[11px] font-bold text-white">Cover</span>}
            <div className="absolute inset-x-2 bottom-2 flex justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
              {i > 0 && (
                <button type="button" onClick={() => onChange([url, ...value.filter((u) => u !== url)])} className="rounded-lg bg-white/95 p-1.5 shadow" aria-label="Make cover photo" title="Make cover photo">
                  <Star className="size-4" />
                </button>
              )}
              <button type="button" onClick={() => onChange(value.filter((u) => u !== url))} className="rounded-lg bg-white/95 p-1.5 text-red-600 shadow" aria-label="Remove photo">
                <X className="size-4" />
              </button>
            </div>
          </div>
        ))}
        {Array.from({ length: uploading }).map((_, i) => (
          <div key={`u${i}`} className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-line bg-stone-50">
            <Loader2 className="size-6 animate-spin text-brand-600" />
          </div>
        ))}
        {value.length + uploading < MAX_IMAGES && (
          <label
            className={cn(
              'flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed text-center text-sm font-semibold transition hover:border-brand-400 hover:bg-brand-50',
              error ? 'border-red-300 text-red-700' : 'border-line text-muted',
            )}
          >
            <ImagePlus className="size-6" />
            Add photos
            <input type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }} />
          </label>
        )}
      </div>
      <p className={cn('mt-2 text-xs', error ? 'font-medium text-red-600' : 'text-muted')}>
        {error ?? `Up to ${MAX_IMAGES} photos · JPG, PNG or WebP · max 5 MB each. The first photo is the cover.`}
      </p>
    </div>
  );
}

function SectionCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card className="p-5 sm:p-7">
      <h2 className="text-lg font-bold">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      <div className="mt-5 space-y-5">{children}</div>
    </Card>
  );
}

export function ListingFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: categories = [] } = useCategories();
  const { data: provinces = [] } = useLocations();

  const existing = useQuery({ queryKey: ['listing', id], queryFn: () => listingApi.get(id!).then((r) => r.listing), enabled: isEdit });

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema) as unknown as Resolver<FormInput, unknown, FormValues>,
    defaultValues: {
      title: '',
      description: '',
      categoryId: '',
      subcategory: '',
      dailyPrice: '' as unknown as number,
      weeklyPrice: null,
      monthlyPrice: null,
      securityDeposit: 0,
      condition: undefined,
      province: user?.province ?? 'DKI Jakarta',
      city: user?.city ?? '',
      district: user?.district ?? '',
      address: '',
      pickupAvailable: true,
      deliveryAvailable: false,
      deliveryFee: 0,
      minRentalDays: 1,
      maxRentalDays: null,
      images: [],
      blockedDates: [],
    },
  });
  const { register, control, handleSubmit, watch, setValue, reset, setError, formState: { errors, isDirty } } = form;
  const blocked = useFieldArray({ control, name: 'blockedDates' });

  useEffect(() => {
    const l = existing.data;
    if (!l) return;
    reset({
      title: l.title,
      description: l.description,
      categoryId: l.category.id,
      subcategory: l.subcategory ?? '',
      dailyPrice: l.dailyPrice,
      weeklyPrice: l.weeklyPrice,
      monthlyPrice: l.monthlyPrice,
      securityDeposit: l.securityDeposit,
      condition: l.condition,
      province: l.province,
      city: l.city,
      district: l.district ?? '',
      address: l.address,
      pickupAvailable: l.pickupAvailable,
      deliveryAvailable: l.deliveryAvailable,
      deliveryFee: l.deliveryFee,
      minRentalDays: l.minRentalDays,
      maxRentalDays: l.maxRentalDays,
      images: l.images.map((i) => i.imageUrl),
      blockedDates: (l.blockedDates ?? []).map((b) => ({ startDate: b.startDate, endDate: b.endDate, note: b.note ?? '' })),
    });
  }, [existing.data, reset]);

  const province = watch('province');
  const city = watch('city');
  const categoryId = watch('categoryId');
  const delivery = watch('deliveryAvailable');
  const cities = provinces.find((p) => p.name === province)?.cities ?? [];
  const districts = cities.find((c) => c.name === city)?.districts ?? [];
  const categorySlug = categories.find((c) => c.id === categoryId)?.slug;

  const save = useMutation({
    mutationFn: (body: ListingInput) => (isEdit ? listingApi.update(id!, body) : listingApi.create(body)),
    onSuccess: ({ listing }) => {
      toast.success(isEdit ? 'Listing updated' : 'Your item is now listed!');
      qc.invalidateQueries({ queryKey: ['listings'] });
      qc.invalidateQueries({ queryKey: ['listing', listing.id] });
      navigate(`/items/${listing.id}`);
    },
    onError: (e) => {
      if (e instanceof ApiError && Object.keys(e.fieldErrors).length) {
        for (const [k, msg] of Object.entries(e.fieldErrors)) setError(k as keyof FormInput, { message: msg });
        toast.error('Please fix the highlighted fields');
      } else toast.error(errorMessage(e));
    },
  });

  const onSubmit = handleSubmit(
    (v) =>
      save.mutate({
        ...v,
        subcategory: v.subcategory || null,
        district: v.district || null,
        deliveryFee: v.deliveryAvailable ? v.deliveryFee : 0,
        blockedDates: v.blockedDates.map((b) => ({ ...b, note: b.note || undefined })),
      }),
    () => toast.error('Please fix the highlighted fields'),
  );

  // Native selects need their options before default values are applied.
  if ((isEdit && existing.isLoading) || !provinces.length || !categories.length) return <Spinner className="min-h-[60vh]" />;
  if (isEdit && (existing.isError || (existing.data && !existing.data.isOwner))) {
    return (
      <div className="container-page py-16">
        <ErrorState message={existing.isError ? errorMessage(existing.error) : 'You can only edit your own listings.'} />
      </div>
    );
  }

  const today = toDateString(new Date());

  return (
    <div className="container-page max-w-4xl py-8 lg:py-10">
      <h1 className="text-3xl font-extrabold tracking-tight">{isEdit ? 'Edit listing' : 'List an item for rent'}</h1>
      <p className="mt-2 text-muted">{isEdit ? 'Changes apply to new bookings. Existing bookings keep their original price.' : 'Great photos and a clear description help your item get booked faster.'}</p>

      <form className="mt-8 space-y-6" onSubmit={onSubmit} noValidate>
        <SectionCard title="Photos">
          <Controller control={control} name="images" render={({ field }) => <ImageUploader value={field.value} onChange={(v) => field.onChange(v)} error={errors.images?.message} />} />
        </SectionCard>

        <SectionCard title="Item details">
          <Field label="Title" htmlFor="title" error={errors.title?.message} required>
            <Input id="title" placeholder="e.g. Canon EOS 600D DSLR + 18-55mm lens" aria-invalid={!!errors.title} {...register('title')} />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Category" htmlFor="categoryId" error={errors.categoryId?.message} required>
              <Select id="categoryId" aria-invalid={!!errors.categoryId} {...register('categoryId')}>
                <option value="">Choose a category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Subcategory" htmlFor="subcategory" hint="Optional">
              <Input id="subcategory" list="subcategory-options" placeholder="e.g. Cameras" {...register('subcategory')} />
              <datalist id="subcategory-options">
                {(categorySlug ? SUBCATEGORY_SUGGESTIONS[categorySlug] ?? [] : []).map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </Field>
          </div>
          <Field label="Description" htmlFor="description" error={errors.description?.message} hint="What's included, accessories, usage tips, any rules." required>
            <Textarea id="description" rows={6} aria-invalid={!!errors.description} {...register('description')} />
          </Field>
          <div>
            <p className="mb-2 text-sm font-semibold">
              Condition<span className="ml-0.5 text-red-500">*</span>
            </p>
            <Controller
              control={control}
              name="condition"
              render={({ field }) => (
                <div className="grid gap-2 sm:grid-cols-4" role="radiogroup">
                  {(Object.keys(CONDITION_LABELS) as ItemCondition[]).map((c) => (
                    <button
                      type="button"
                      role="radio"
                      aria-checked={field.value === c}
                      key={c}
                      onClick={() => field.onChange(c)}
                      className={cn('rounded-xl border p-3 text-left transition', field.value === c ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-100' : 'border-line hover:border-stone-300')}
                    >
                      <span className="block text-sm font-bold">{CONDITION_LABELS[c]}</span>
                      <span className="block text-xs text-muted">{CONDITION_HINTS[c]}</span>
                    </button>
                  ))}
                </div>
              )}
            />
            {errors.condition && <p className="mt-1.5 text-xs font-medium text-red-600">{errors.condition.message}</p>}
          </div>
        </SectionCard>

        <SectionCard title="Pricing" description="All prices in Indonesian Rupiah. Weekly and monthly prices are optional discounts.">
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Daily price (Rp)" htmlFor="dailyPrice" error={errors.dailyPrice?.message} required>
              <Input id="dailyPrice" type="number" inputMode="numeric" min={1000} step={1000} placeholder="100000" aria-invalid={!!errors.dailyPrice} {...register('dailyPrice')} />
            </Field>
            <Field label="Weekly price (Rp)" htmlFor="weeklyPrice" error={errors.weeklyPrice?.message} hint="Optional · 7 days">
              <Input id="weeklyPrice" type="number" inputMode="numeric" min={0} step={1000} aria-invalid={!!errors.weeklyPrice} {...register('weeklyPrice')} />
            </Field>
            <Field label="Monthly price (Rp)" htmlFor="monthlyPrice" error={errors.monthlyPrice?.message} hint="Optional · 30 days">
              <Input id="monthlyPrice" type="number" inputMode="numeric" min={0} step={1000} aria-invalid={!!errors.monthlyPrice} {...register('monthlyPrice')} />
            </Field>
          </div>
          <Field label="Refundable security deposit (Rp)" htmlFor="securityDeposit" error={errors.securityDeposit?.message} hint="Returned to the renter when the item comes back in the same condition. Shown separately from the rental fee." required>
            <Input id="securityDeposit" type="number" inputMode="numeric" min={0} step={10000} aria-invalid={!!errors.securityDeposit} {...register('securityDeposit')} className="sm:max-w-xs" />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Minimum rental (days)" htmlFor="minRentalDays" error={errors.minRentalDays?.message}>
              <Input id="minRentalDays" type="number" min={1} max={365} {...register('minRentalDays')} />
            </Field>
            <Field label="Maximum rental (days)" htmlFor="maxRentalDays" error={errors.maxRentalDays?.message} hint="Optional">
              <Input id="maxRentalDays" type="number" min={1} max={365} {...register('maxRentalDays')} />
            </Field>
          </div>
        </SectionCard>

        <SectionCard title="Location & fulfillment" description="Only the area and pickup description are shown publicly.">
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Province" htmlFor="province" error={errors.province?.message} required>
              <Select
                id="province"
                {...register('province', {
                  onChange: () => {
                    setValue('city', '');
                    setValue('district', '');
                  },
                })}
              >
                <option value="">Choose province</option>
                {provinces.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="City" htmlFor="city" error={errors.city?.message} required>
              <Select id="city" aria-invalid={!!errors.city} {...register('city', { onChange: () => setValue('district', '') })}>
                <option value="">Choose city</option>
                {cities.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="District / area" htmlFor="district">
              <Select id="district" {...register('district')}>
                <option value="">Choose district</option>
                {districts.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Pickup location description" htmlFor="address" error={errors.address?.message} hint="e.g. “Lobby of Blok M Plaza” — avoid your full home address." required>
            <Input id="address" aria-invalid={!!errors.address} {...register('address')} />
          </Field>
          <div className="space-y-3 rounded-2xl bg-stone-50 p-4">
            <label className="flex items-center justify-between gap-3">
              <span>
                <span className="block text-sm font-semibold">Self pickup</span>
                <span className="block text-xs text-muted">Renter picks up and returns the item</span>
              </span>
              <Controller control={control} name="pickupAvailable" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
            </label>
            <label className="flex items-center justify-between gap-3">
              <span>
                <span className="block text-sm font-semibold">Owner delivery</span>
                <span className="block text-xs text-muted">You deliver the item for a fee</span>
              </span>
              <Controller control={control} name="deliveryAvailable" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
            </label>
            {delivery && (
              <Field label="Delivery fee (Rp)" htmlFor="deliveryFee" error={errors.deliveryFee?.message}>
                <Input id="deliveryFee" type="number" min={0} step={5000} {...register('deliveryFee')} className="sm:max-w-xs" />
              </Field>
            )}
            {errors.pickupAvailable && <p className="text-xs font-medium text-red-600">{errors.pickupAvailable.message}</p>}
          </div>
        </SectionCard>

        <SectionCard title="Availability" description="Your item is available every day by default. Block dates when you need it yourself.">
          {blocked.fields.length === 0 && (
            <p className="flex items-center gap-2 text-sm text-muted">
              <CalendarX className="size-4" /> No blocked dates
            </p>
          )}
          {blocked.fields.map((f, i) => (
            <div key={f.id} className="grid items-start gap-3 rounded-xl border border-line p-3 sm:grid-cols-[1fr_1fr_1.4fr_auto]">
              <Field label="From" htmlFor={`b-s-${i}`} error={errors.blockedDates?.[i]?.startDate?.message}>
                <Input id={`b-s-${i}`} type="date" min={today} {...register(`blockedDates.${i}.startDate`)} />
              </Field>
              <Field label="To" htmlFor={`b-e-${i}`} error={errors.blockedDates?.[i]?.endDate?.message}>
                <Input id={`b-e-${i}`} type="date" min={today} {...register(`blockedDates.${i}.endDate`)} />
              </Field>
              <Field label="Note (private)" htmlFor={`b-n-${i}`}>
                <Input id={`b-n-${i}`} placeholder="e.g. Using it myself" {...register(`blockedDates.${i}.note`)} />
              </Field>
              <Button type="button" variant="ghost" size="icon" className="sm:mt-7" onClick={() => blocked.remove(i)} aria-label="Remove blocked dates">
                <Trash2 className="text-red-600" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" onClick={() => blocked.append({ startDate: '', endDate: '', note: '' })}>
            <Plus /> Block dates
          </Button>
        </SectionCard>

        <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-3 border-t border-line bg-canvas/95 px-4 py-4 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
          <Button type="button" variant="outline" asChild>
            <Link to={isEdit ? '/dashboard/listings' : '/'}>Cancel</Link>
          </Button>
          <Button type="submit" size="lg" loading={save.isPending} disabled={isEdit && !isDirty}>
            {isEdit ? 'Save changes' : 'Publish listing'}
          </Button>
        </div>
      </form>
    </div>
  );
}
