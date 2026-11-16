import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/ui/misc';

/** Redirects guests to the login page, returning them afterwards. */
export function RequireAuth() {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return <Spinner className="min-h-[50vh]" />;
  if (!user) return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  return <Outlet />;
}

/** Client-side guard for admin pages. The API enforces the same rule on every admin endpoint. */
export function RequireAdmin() {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return <Spinner className="min-h-[50vh]" />;
  if (!user) return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  if (user.role !== 'ADMIN') return <Navigate to="/" replace />;
  return <Outlet />;
}

/** Keeps logged-in users away from login/register. */
export function GuestOnly() {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return <Spinner className="min-h-[50vh]" />;
  if (user) {
    const redirect = new URLSearchParams(location.search).get('redirect');
    return <Navigate to={redirect && redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/dashboard'} replace />;
  }
  return <Outlet />;
}
