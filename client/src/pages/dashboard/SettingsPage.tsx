import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Camera } from 'lucide-react';
import { authApi, meApi, oauthStartUrl, uploadApi } from '@/services/endpoints';
import { ApiError, errorMessage } from '@/services/api';
import { useAuth, ME_KEY } from '@/hooks/useAuth';
import { useAppConfig, useLocations } from '@/hooks/useMeta';
import { OAUTH_ERRORS, ProviderIcon } from '@/components/SocialLogin';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Switch, Textarea } from '@/components/ui/form-controls';
import { Badge, Card, PageHeader, UserAvatar } from '@/components/ui/misc';
import { LocationSelect } from '@/components/common';
import type { Me } from '@/types';

const phoneRule = z
  .string()
  .trim()
  .refine((v) => /^(\+62|62|0)8\d{7,12}$/.test(v.replace(/[\s-]/g, '')), 'Enter a valid Indonesian phone number');

const profileSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name').max(80),
  phone: phoneRule,
  city: z.string().min(1, 'Choose your city'),
  district: z.string().optional(),
  bio: z.string().max(500, 'Max 500 characters').optional(),
});

function ProfileSection({ user }: { user: Me }) {
  const qc = useQueryClient();
  const { data: provinces = [] } = useLocations();
  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user.name, phone: user.phone, city: user.city, district: user.district ?? '', bio: user.bio ?? '' },
  });
  const { register, control, handleSubmit, watch, setValue, reset, formState: { errors, isDirty } } = form;
  // Re-apply once locations load: a native <select> can't show a value before its options exist.
  useEffect(() => reset({ name: user.name, phone: user.phone, city: user.city, district: user.district ?? '', bio: user.bio ?? '' }), [user, reset, provinces.length]);
  const city = watch('city');
  const districts = provinces.flatMap((p) => p.cities).find((c) => c.name === city)?.districts ?? [];

  const save = useMutation({
    mutationFn: meApi.updateProfile,
    onSuccess: ({ user: u }) => {
      qc.setQueryData(ME_KEY, u);
      toast.success('Profile updated');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const avatar = useMutation({
    mutationFn: uploadApi.avatar,
    onSuccess: ({ user: u }) => {
      qc.setQueryData(ME_KEY, u);
      toast.success('Profile photo updated');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Card className="p-5 sm:p-7">
      <h2 className="text-lg font-bold">Profile & contact details</h2>
      <p className="text-sm text-muted">Your name, photo, city and bio are public. Your phone is shared only with people whose booking you accept (or who accept yours).</p>
      <div className="mt-6 flex items-center gap-4">
        <UserAvatar name={user.name} src={user.profileImage} className="size-20 text-xl" />
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm font-semibold hover:bg-stone-50">
          <Camera className="size-4" /> {avatar.isPending ? 'Uploading…' : 'Change photo'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={avatar.isPending}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              if (f.size > 5 * 1024 * 1024) return void toast.error('Image must be 5 MB or smaller');
              avatar.mutate(f);
            }}
          />
        </label>
      </div>
      <form
        className="mt-6 grid gap-5 sm:grid-cols-2"
        noValidate
        onSubmit={handleSubmit((v) => save.mutate({ ...v, district: v.district || null, bio: v.bio?.trim() || null }))}
      >
        <Field label="Full name" htmlFor="s-name" error={errors.name?.message}>
          <Input id="s-name" {...register('name')} aria-invalid={!!errors.name} />
        </Field>
        <Field label="Email" htmlFor="s-email" hint="Email changes are not supported yet">
          <Input id="s-email" value={user.email} disabled />
        </Field>
        <Field label="Phone number" htmlFor="s-phone" error={errors.phone?.message}>
          <Input id="s-phone" type="tel" {...register('phone')} aria-invalid={!!errors.phone} />
        </Field>
        <Field label="City" htmlFor="s-city" error={errors.city?.message}>
          <Controller
            control={control}
            name="city"
            render={({ field }) => (
              <LocationSelect
                id="s-city"
                value={field.value}
                onChange={(v) => {
                  field.onChange(v);
                  setValue('district', '', { shouldDirty: true });
                }}
                includeProvinces={false}
                allLabel="Choose city"
              />
            )}
          />
        </Field>
        <Field label="District" htmlFor="s-district">
          <Select id="s-district" {...register('district')}>
            <option value="">Choose district</option>
            {districts.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </Select>
        </Field>
        <Field label="Bio" htmlFor="s-bio" error={errors.bio?.message} className="sm:col-span-2">
          <Textarea id="s-bio" rows={3} placeholder="Tell renters a little about yourself" {...register('bio')} />
        </Field>
        <div className="sm:col-span-2">
          <Button type="submit" loading={save.isPending} disabled={!isDirty}>
            Save profile
          </Button>
        </div>
      </form>
    </Card>
  );
}

const passwordSchema = (hasPassword: boolean) =>
  z
    .object({
      currentPassword: hasPassword ? z.string().min(1, 'Enter your current password') : z.string().optional(),
      newPassword: z.string().min(8, 'At least 8 characters').refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), 'Use letters and numbers'),
      confirm: z.string(),
    })
    .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });

type PasswordValues = { currentPassword?: string; newPassword: string; confirm: string };

function PasswordSection({ user }: { user: Me }) {
  const qc = useQueryClient();
  const { register, handleSubmit, reset, setError, formState: { errors } } = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema(user.hasPassword)) });
  const change = useMutation({
    mutationFn: meApi.changePassword,
    onSuccess: ({ user: u }) => {
      toast.success(user.hasPassword ? 'Password changed' : 'Password set. You can now also log in with your email.');
      qc.setQueryData(ME_KEY, u);
      reset({ currentPassword: '', newPassword: '', confirm: '' });
    },
    onError: (e) => {
      if (e instanceof ApiError && e.fieldErrors.currentPassword) setError('currentPassword', { message: e.fieldErrors.currentPassword });
      else toast.error(errorMessage(e));
    },
  });
  return (
    <Card className="p-5 sm:p-7">
      <h2 className="text-lg font-bold">Password</h2>
      {!user.hasPassword && (
        <p className="text-sm text-muted">You signed up with a social login. Set a password to also log in with {user.email}.</p>
      )}
      <form
        className="mt-5 grid gap-5 sm:grid-cols-3"
        noValidate
        onSubmit={handleSubmit(({ currentPassword, newPassword }) => change.mutate({ currentPassword: user.hasPassword ? currentPassword : undefined, newPassword }))}
      >
        {user.hasPassword && (
          <Field label="Current password" htmlFor="p-cur" error={errors.currentPassword?.message}>
            <Input id="p-cur" type="password" autoComplete="current-password" {...register('currentPassword')} />
          </Field>
        )}
        <Field label="New password" htmlFor="p-new" error={errors.newPassword?.message}>
          <Input id="p-new" type="password" autoComplete="new-password" {...register('newPassword')} />
        </Field>
        <Field label="Confirm new password" htmlFor="p-conf" error={errors.confirm?.message}>
          <Input id="p-conf" type="password" autoComplete="new-password" {...register('confirm')} />
        </Field>
        <div className="sm:col-span-3">
          <Button type="submit" variant="outline" loading={change.isPending}>
            {user.hasPassword ? 'Update password' : 'Set password'}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function ConnectedAccountsSection({ user }: { user: Me }) {
  const qc = useQueryClient();
  const { data: config } = useAppConfig();
  const [params, setParams] = useSearchParams();
  const [toRemove, setToRemove] = useState<{ key: string; label: string } | null>(null);
  const providers = config?.oauthProviders ?? [];
  // Also list connected providers that were later disabled on the server, so they can be removed.
  const all = [...providers, ...user.connectedProviders.filter((k) => !providers.some((p) => p.key === k)).map((k) => ({ key: k, label: k }))];

  useEffect(() => {
    const connected = params.get('connected');
    const err = params.get('oauthError');
    if (!connected && !err) return;
    if (connected) {
      toast.success(`${providers.find((p) => p.key === connected)?.label ?? connected} connected. You can now use it to log in.`, { id: 'oauth-result' });
      qc.invalidateQueries({ queryKey: ME_KEY });
    }
    if (err) toast.error(OAUTH_ERRORS[err] ?? OAUTH_ERRORS.failed, { id: 'oauth-result' });
    const next = new URLSearchParams(params);
    next.delete('connected');
    next.delete('oauthError');
    next.delete('provider');
    setParams(next, { replace: true });
  }, [params, setParams, providers, qc]);

  const remove = useMutation({
    mutationFn: (key: string) => authApi.disconnect(key),
    onSuccess: ({ user: u }) => {
      qc.setQueryData(ME_KEY, u);
      toast.success('Login method removed');
      setToRemove(null);
    },
    onError: (e) => {
      toast.error(errorMessage(e));
      setToRemove(null);
    },
  });

  if (all.length === 0) return null;
  const loginMethods = user.connectedProviders.length + (user.hasPassword ? 1 : 0);

  return (
    <Card className="p-5 sm:p-7">
      <h2 className="text-lg font-bold">Login methods</h2>
      <p className="text-sm text-muted">Connect accounts to log in with one click. We only use them to confirm it's you.</p>
      <ul className="mt-5 divide-y divide-line">
        <li className="flex items-center gap-3 py-3">
          <span className="flex size-9 items-center justify-center rounded-xl bg-stone-100 text-sm font-bold">@</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Email and password</p>
            <p className="truncate text-xs text-muted">{user.hasPassword ? user.email : 'Not set up. Set a password below.'}</p>
          </div>
          {user.hasPassword && <Badge tone="green">Active</Badge>}
        </li>
        {all.map((p) => {
          const connected = user.connectedProviders.includes(p.key);
          return (
            <li key={p.key} className="flex items-center gap-3 py-3">
              <span className="flex size-9 items-center justify-center rounded-xl border border-line bg-white">
                <ProviderIcon provider={p.key} />
              </span>
              <div className="flex-1">
                <p className="text-sm font-semibold">{p.label}</p>
                <p className="text-xs text-muted">{connected ? 'Connected' : 'Not connected'}</p>
              </div>
              {connected ? (
                <Button
                  size="sm"
                  variant="danger-outline"
                  onClick={() => setToRemove(p)}
                  disabled={loginMethods <= 1}
                  title={loginMethods <= 1 ? 'This is your only way to log in' : undefined}
                >
                  Remove
                </Button>
              ) : providers.some((x) => x.key === p.key) ? (
                <Button size="sm" variant="outline" asChild>
                  <a href={oauthStartUrl(p.key, { mode: 'connect' })}>Connect</a>
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
      {loginMethods <= 1 && user.connectedProviders.length > 0 && (
        <p className="mt-2 text-xs text-muted">To remove this login method, first set a password or connect another one.</p>
      )}
      <ConfirmDialog
        open={Boolean(toRemove)}
        onOpenChange={(o) => !o && setToRemove(null)}
        title={`Remove ${toRemove?.label}?`}
        description={`You won't be able to log in with ${toRemove?.label} until you connect it again.`}
        confirmLabel="Remove"
        destructive
        loading={remove.isPending}
        onConfirm={() => toRemove && remove.mutate(toRemove.key)}
      />
    </Card>
  );
}

function NotificationSection({ user }: { user: Me }) {
  const qc = useQueryClient();
  const [prefs, setPrefs] = useState({ notifyBookings: user.notifyBookings, notifyMessages: user.notifyMessages });
  const save = useMutation({
    mutationFn: meApi.updatePrefs,
    onSuccess: ({ user: u }) => {
      qc.setQueryData(ME_KEY, u);
      toast.success('Notification preferences saved');
    },
    onError: (e) => {
      toast.error(errorMessage(e));
      setPrefs({ notifyBookings: user.notifyBookings, notifyMessages: user.notifyMessages });
    },
  });
  const update = (patch: Partial<typeof prefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    save.mutate(next);
  };
  return (
    <Card className="p-5 sm:p-7">
      <h2 className="text-lg font-bold">Notifications</h2>
      <p className="text-sm text-muted">Choose which in-app notifications you receive.</p>
      <div className="mt-5 divide-y divide-line">
        <label className="flex items-center justify-between gap-4 py-3">
          <span>
            <span className="block text-sm font-semibold">Booking updates</span>
            <span className="block text-xs text-muted">New requests, acceptances, cancellations and completed rentals</span>
          </span>
          <Switch checked={prefs.notifyBookings} onCheckedChange={(v) => update({ notifyBookings: v })} />
        </label>
        <label className="flex items-center justify-between gap-4 py-3">
          <span>
            <span className="block text-sm font-semibold">New messages</span>
            <span className="block text-xs text-muted">When someone sends you a message</span>
          </span>
          <Switch checked={prefs.notifyMessages} onCheckedChange={(v) => update({ notifyMessages: v })} />
        </label>
        <div className="flex items-center justify-between gap-4 py-3 opacity-60">
          <span>
            <span className="block text-sm font-semibold">Email & push notifications</span>
            <span className="block text-xs text-muted">Not available in this version</span>
          </span>
          <Badge>Coming soon</Badge>
        </div>
      </div>
    </Card>
  );
}

export function SettingsPage() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <div className="space-y-6">
      <PageHeader title="Account settings" />
      <ProfileSection user={user} />
      <ConnectedAccountsSection user={user} />
      <PasswordSection user={user} />
      <NotificationSection user={user} />
    </div>
  );
}
