import { oauthStartUrl } from '@/services/endpoints';
import { useAppConfig } from '@/hooks/useMeta';
import { cn } from '@/utils/cn';

/** Official-style brand marks (inline so no external image requests are needed). */
export function ProviderIcon({ provider, className }: { provider: string; className?: string }) {
  const cls = cn('size-5 shrink-0', className);
  switch (provider) {
    case 'google':
      return (
        <svg viewBox="0 0 48 48" className={cls} aria-hidden>
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
          <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
        </svg>
      );
    case 'facebook':
      return (
        <svg viewBox="0 0 24 24" className={cls} aria-hidden>
          <path fill="#1877F2" d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z" />
        </svg>
      );
    case 'github':
      return (
        <svg viewBox="0 0 24 24" className={cls} aria-hidden>
          <path fill="currentColor" d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 0-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.2.5-2.3 1.3-3.1-.2-.4-.6-1.6 0-3.2 0 0 1-.3 3.4 1.2a11.5 11.5 0 0 1 6 0C17.3 4.6 18.3 5 18.3 5c.7 1.6.2 2.9.1 3.2.8.8 1.3 1.9 1.3 3.1 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3" />
        </svg>
      );
    default:
      return <span className={cn('flex items-center justify-center rounded-full bg-stone-200 text-xs font-bold', cls)}>{provider[0]?.toUpperCase()}</span>;
  }
}

/** "Continue with ..." buttons for every provider the server has configured. Renders nothing if none are. */
export function SocialLoginButtons({ redirect, verb = 'Continue' }: { redirect?: string | null; verb?: string }) {
  const { data } = useAppConfig();
  const providers = data?.oauthProviders ?? [];
  if (providers.length === 0) return null;
  return (
    <div>
      <div className="grid gap-2.5">
        {providers.map((p) => (
          // Plain links: the server redirects the whole page to the provider and back.
          <a
            key={p.key}
            href={oauthStartUrl(p.key, { redirect: redirect ?? undefined })}
            className="flex h-12 items-center justify-center gap-3 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-ink shadow-sm transition-colors hover:bg-stone-50"
          >
            <ProviderIcon provider={p.key} />
            {verb} with {p.label}
          </a>
        ))}
      </div>
      <div className="my-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-muted">
        <span className="h-px flex-1 bg-line" /> or use your email <span className="h-px flex-1 bg-line" />
      </div>
    </div>
  );
}

export const OAUTH_ERRORS: Record<string, string> = {
  email_exists:
    'An account with this email already exists. Log in with your email and password, then connect this login method in Account settings.',
  no_email: 'We need a verified email address from that account. Please verify your email with the provider, or sign up with email instead.',
  cancelled: 'Sign-in was cancelled.',
  state: 'That sign-in link expired or was already used. Please try again.',
  failed: "We couldn't complete sign-in with that provider. Please try again.",
  suspended: 'This account has been suspended. Please contact support.',
  unavailable: 'That login method is not available right now.',
  rate_limited: 'Too many sign-in attempts. Please wait a few minutes and try again.',
  already_linked: 'That account is already connected to a different Rentora account.',
};
