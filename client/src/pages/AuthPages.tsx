import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Camera, Eye, EyeOff, Info } from 'lucide-react';
import { useLogin, useRegister, ME_KEY } from '@/hooks/useAuth';
import { ApiError, errorMessage } from '@/services/api';
import { uploadApi } from '@/services/endpoints';
import { Logo, LocationSelect } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/form-controls';
import { Spinner, UserAvatar } from '@/components/ui/misc';
import { OAUTH_ERRORS, ProviderIcon, SocialLoginButtons } from '@/components/SocialLogin';
import { authApi } from '@/services/endpoints';
import { useLocations } from '@/hooks/useMeta';
import { useQuery, useMutation } from '@tanstack/react-query';
import { BRAND } from '@/config/brand';

const unsplash = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=80`;

function safeRedirect(value: string | null) {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/dashboard';
}

function AuthShell({ title, subtitle, children }: { title: string; subtitle: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Logo />
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
          <p className="mt-2 text-muted">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
      <div className="relative hidden lg:block">
        <img src={unsplash('1504280390367-361c6d9f38f4')} alt="" className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-900/80 via-brand-900/20 to-transparent" />
        <div className="absolute bottom-12 left-12 right-12 text-white">
          <p className="text-3xl font-extrabold leading-tight">{BRAND.tagline}</p>
          <p className="mt-3 max-w-md text-brand-100">Join neighbours across Jakarta who share cameras, camping gear, tools and more.</p>
        </div>
      </div>
    </div>
  );
}

function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement> & { ref?: React.Ref<HTMLInputElement> }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={show ? 'text' : 'password'} className="pr-11" />
      <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted" aria-label={show ? 'Hide password' : 'Show password'}>
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});

export function LoginPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const login = useLogin();
  const oauthError = params.get('oauthError');
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema) });

  return (
    <AuthShell
      title="Welcome back"
      subtitle={
        <>
          New to {BRAND.name}?{' '}
          <Link to={`/register${params.get('redirect') ? `?redirect=${encodeURIComponent(params.get('redirect')!)}` : ''}`} className="font-semibold text-brand-700 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      {oauthError && (
        <p className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
          {OAUTH_ERRORS[oauthError] ?? OAUTH_ERRORS.failed}
        </p>
      )}
      <SocialLoginButtons redirect={params.get('redirect')} />
      <form
        className="space-y-5"
        noValidate
        onSubmit={handleSubmit((values) =>
          login.mutate(values, {
            onSuccess: ({ user }) => {
              toast.success(`Welcome back, ${user.name.split(' ')[0]}!`);
              navigate(safeRedirect(params.get('redirect')), { replace: true });
            },
          }),
        )}
      >
        {login.isError && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
            {errorMessage(login.error)}
          </p>
        )}
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...register('email')} />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password?.message}>
          <PasswordInput id="password" autoComplete="current-password" aria-invalid={!!errors.password} {...register('password')} />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={login.isPending}>
          Log in
        </Button>
      </form>
      <div className="mt-6 flex gap-2 rounded-xl border border-brand-100 bg-brand-50 p-4 text-sm text-brand-900">
        <Info className="mt-0.5 size-4 shrink-0" />
        <p>
          Demo account: <code className="font-semibold">budi@rentora.test</code> / <code className="font-semibold">Rentora123</code>. Admin:{' '}
          <code className="font-semibold">admin@rentora.test</code> (same password). Available after running the seed script.
        </p>
      </div>
    </AuthShell>
  );
}

const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Enter your full name').max(80),
    email: z.string().trim().email('Enter a valid email address'),
    phone: z
      .string()
      .trim()
      .refine((v) => /^(\+62|62|0)8\d{7,12}$/.test(v.replace(/[\s-]/g, '')), 'Enter a valid Indonesian phone number, e.g. 0812xxxxxxxx'),
    city: z.string().min(1, 'Choose your city'),
    password: z
      .string()
      .min(8, 'At least 8 characters')
      .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), 'Use letters and numbers'),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' });

type RegisterValues = z.infer<typeof registerSchema>;

export function RegisterPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const registerMutation = useRegister();
  const [avatar, setAvatar] = useState<File | null>(null);
  const [avatarError, setAvatarError] = useState('');
  const avatarPreview = useMemo(() => (avatar ? URL.createObjectURL(avatar) : null), [avatar]);
  useEffect(() => () => {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
  }, [avatarPreview]);
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterValues>({ resolver: zodResolver(registerSchema), defaultValues: { city: BRAND.defaultCity } });

  const onSubmit = handleSubmit(async ({ confirmPassword: _c, ...values }) => {
    void _c;
    try {
      const { user } = await registerMutation.mutateAsync(values);
      if (avatar) {
        try {
          const res = await uploadApi.avatar(avatar);
          qc.setQueryData(ME_KEY, res.user);
        } catch (e) {
          toast.error(`Account created, but the photo upload failed: ${errorMessage(e)}`);
        }
      }
      toast.success(`Welcome to ${BRAND.name}, ${user.name.split(' ')[0]}!`);
      navigate(safeRedirect(params.get('redirect')), { replace: true });
    } catch (e) {
      if (e instanceof ApiError) {
        for (const [k, msg] of Object.entries(e.fieldErrors)) {
          if (k in registerSchema.innerType().shape) setError(k as keyof RegisterValues, { message: msg });
        }
        if (e.status === 409) setError('email', { message: e.message });
      }
    }
  });

  return (
    <AuthShell
      title="Create your account"
      subtitle={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-brand-700 hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <SocialLoginButtons redirect={params.get('redirect')} verb="Sign up" />
      <form className="space-y-5" noValidate onSubmit={onSubmit}>
        {registerMutation.isError && !(registerMutation.error instanceof ApiError && Object.keys(registerMutation.error.fieldErrors).length) && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
            {errorMessage(registerMutation.error)}
          </p>
        )}
        <div className="flex items-center gap-4">
          <UserAvatar name="?" src={avatarPreview} className="size-16" />
          <div>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold hover:bg-stone-50">
              <Camera className="size-4" /> {avatar ? 'Change photo' : 'Add profile photo'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  setAvatarError('');
                  if (!f) return;
                  if (f.size > 5 * 1024 * 1024) return setAvatarError('Image must be 5 MB or smaller');
                  setAvatar(f);
                }}
              />
            </label>
            <p className="mt-1 text-xs text-muted">{avatarError ? <span className="text-red-600">{avatarError}</span> : 'Optional · JPG, PNG or WebP up to 5 MB'}</p>
          </div>
        </div>
        <Field label="Full name" htmlFor="name" error={errors.name?.message} required>
          <Input id="name" autoComplete="name" aria-invalid={!!errors.name} {...register('name')} />
        </Field>
        <Field label="Email" htmlFor="email" error={errors.email?.message} required>
          <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...register('email')} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Phone number" htmlFor="phone" error={errors.phone?.message} required>
            <Input id="phone" type="tel" autoComplete="tel" placeholder="0812xxxxxxxx" aria-invalid={!!errors.phone} {...register('phone')} />
          </Field>
          <Field label="City" htmlFor="city" error={errors.city?.message} required>
            <Controller
              control={control}
              name="city"
              render={({ field }) => <LocationSelect id="city" value={field.value} onChange={field.onChange} includeProvinces={false} allLabel="Choose city" />}
            />
          </Field>
        </div>
        <Field label="Password" htmlFor="password" error={errors.password?.message} hint="At least 8 characters with letters and numbers" required>
          <PasswordInput id="password" autoComplete="new-password" aria-invalid={!!errors.password} {...register('password')} />
        </Field>
        <Field label="Confirm password" htmlFor="confirmPassword" error={errors.confirmPassword?.message} required>
          <PasswordInput id="confirmPassword" autoComplete="new-password" aria-invalid={!!errors.confirmPassword} {...register('confirmPassword')} />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={registerMutation.isPending}>
          Create account
        </Button>
        <p className="text-center text-xs text-muted">
          By signing up you agree to our{' '}
          <Link to="/terms" className="underline">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link to="/privacy" className="underline">
            Privacy Policy
          </Link>
          .
        </p>
      </form>
    </AuthShell>
  );
}

const completeSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name').max(80),
  phone: z
    .string()
    .trim()
    .refine((v) => /^(\+62|62|0)8\d{7,12}$/.test(v.replace(/[\s-]/g, '')), 'Enter a valid Indonesian phone number, e.g. 0812xxxxxxxx'),
  city: z.string().min(1, 'Choose your city'),
  district: z.string().optional(),
});

/** Second step after a social login for a new user: phone and city are required for every account. */
export function CompleteSignupPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: provinces = [] } = useLocations();
  const pending = useQuery({
    queryKey: ['oauth-pending'],
    queryFn: () => authApi.pendingSignup().then((r) => r.pending),
    retry: false,
    staleTime: Infinity,
  });
  const form = useForm<z.infer<typeof completeSchema>>({ resolver: zodResolver(completeSchema), defaultValues: { name: '', city: BRAND.defaultCity, district: '' } });
  const { register, control, handleSubmit, reset, watch, setValue, setError, formState: { errors } } = form;

  useEffect(() => {
    if (pending.data) reset({ name: pending.data.name, phone: '', city: BRAND.defaultCity, district: '' });
  }, [pending.data, reset]);

  const city = watch('city');
  const districts = provinces.flatMap((p) => p.cities).find((c) => c.name === city)?.districts ?? [];

  const complete = useMutation({
    mutationFn: authApi.completeSignup,
    onSuccess: ({ user, redirect }) => {
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'meta' });
      qc.setQueryData(ME_KEY, user);
      toast.success(`Welcome to ${BRAND.name}, ${user.name.split(' ')[0]}!`);
      navigate(safeRedirect(redirect), { replace: true });
    },
    onError: (e) => {
      if (e instanceof ApiError) for (const [k, msg] of Object.entries(e.fieldErrors)) setError(k as 'name', { message: msg });
    },
  });

  if (pending.isLoading) return <Spinner className="min-h-dvh" />;
  if (!pending.data) {
    return (
      <AuthShell title="Sign-up session expired" subtitle="For your security, this step must be finished within 15 minutes.">
        <Button asChild size="lg" className="w-full">
          <Link to="/register">Start again</Link>
        </Button>
      </AuthShell>
    );
  }
  const p = pending.data;

  return (
    <AuthShell title="Almost done" subtitle="Add a few details so owners and renters can arrange pickups with you.">
      <div className="mb-6 flex items-center gap-3 rounded-2xl border border-line bg-white p-4">
        <UserAvatar name={p.name || p.email} src={p.picture} className="size-12" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{p.email}</p>
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <ProviderIcon provider={p.provider} className="size-3.5" /> Verified with {p.providerLabel}
          </p>
        </div>
      </div>
      <form className="space-y-5" noValidate onSubmit={handleSubmit((v) => complete.mutate({ ...v, district: v.district || undefined }))}>
        {complete.isError && !(complete.error instanceof ApiError && Object.keys(complete.error.fieldErrors).length) && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
            {errorMessage(complete.error)}
          </p>
        )}
        <Field label="Full name" htmlFor="c-name" error={errors.name?.message} required>
          <Input id="c-name" autoComplete="name" aria-invalid={!!errors.name} {...register('name')} />
        </Field>
        <Field label="Phone number" htmlFor="c-phone" error={errors.phone?.message} hint="Shared only with people whose booking you accept, or who accept yours" required>
          <Input id="c-phone" type="tel" autoComplete="tel" placeholder="0812xxxxxxxx" aria-invalid={!!errors.phone} {...register('phone')} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="City" htmlFor="c-city" error={errors.city?.message} required>
            <Controller
              control={control}
              name="city"
              render={({ field }) => (
                <LocationSelect
                  id="c-city"
                  value={field.value}
                  onChange={(v) => {
                    field.onChange(v);
                    setValue('district', '');
                  }}
                  includeProvinces={false}
                  allLabel="Choose city"
                />
              )}
            />
          </Field>
          <Field label="District" htmlFor="c-district">
            <Select id="c-district" {...register('district')}>
              <option value="">Choose district</option>
              {districts.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Button type="submit" size="lg" className="w-full" loading={complete.isPending}>
          Create account
        </Button>
        <p className="text-center text-xs text-muted">
          By continuing you agree to our{' '}
          <Link to="/terms" className="underline">Terms of Service</Link> and{' '}
          <Link to="/privacy" className="underline">Privacy Policy</Link>.
        </p>
      </form>
    </AuthShell>
  );
}
