import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  CalendarCheck,
  Heart,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Package,
  Plus,
  Search,
  Settings,
  Shield,
  X,
} from 'lucide-react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { toast } from 'sonner';
import { Logo, CategoryIcon } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownSeparator, DropdownTrigger } from '@/components/ui/dropdown';
import { UserAvatar } from '@/components/ui/misc';
import { useAuth, useLogout } from '@/hooks/useAuth';
import { useCounts } from '@/hooks/useCounts';
import { useCategories } from '@/hooks/useMeta';
import { notificationApi } from '@/services/endpoints';
import { cn } from '@/utils/cn';
import { timeAgo } from '@/utils/format';

function CountBadge({ count }: { count?: number }) {
  if (!count) return null;
  return (
    <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
      {count > 9 ? '9+' : count}
    </span>
  );
}

function NavSearch() {
  const [q, setQ] = useState('');
  const navigate = useNavigate();
  return (
    <form
      className="relative hidden w-full max-w-xs lg:block"
      onSubmit={(e) => {
        e.preventDefault();
        navigate(`/explore${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`);
      }}
      role="search"
    >
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search cameras, tents, drills..."
        aria-label="Search items"
        className="h-10 w-full rounded-full border border-line bg-stone-50 pl-10 pr-4 text-sm focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-3 focus:ring-brand-100"
      />
    </form>
  );
}

function NotificationsMenu({ count }: { count?: number }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { data } = useQuery({ queryKey: ['notifications', 'menu'], queryFn: () => notificationApi.list(1), enabled: open });
  const readAll = useMutation({
    mutationFn: notificationApi.readAll,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['counts'] });
    },
  });
  const readOne = useMutation({
    mutationFn: notificationApi.read,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['counts'] });
    },
  });

  return (
    <Dropdown open={open} onOpenChange={setOpen}>
      <DropdownTrigger asChild>
        <button className="relative rounded-full p-2.5 text-ink hover:bg-stone-100" aria-label={`Notifications${count ? ` (${count} unread)` : ''}`}>
          <Bell className="size-5" />
          <CountBadge count={count} />
        </button>
      </DropdownTrigger>
      <DropdownContent className="w-[22rem] p-0">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <p className="font-bold">Notifications</p>
          {Boolean(count) && (
            <button className="text-xs font-semibold text-brand-700 hover:underline" onClick={() => readAll.mutate()}>
              Mark all as read
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto p-1.5">
          {!data ? (
            <p className="px-3 py-6 text-center text-sm text-muted">Loading…</p>
          ) : data.items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted">You're all caught up.</p>
          ) : (
            data.items.slice(0, 8).map((n) => (
              <DropdownItem
                key={n.id}
                className="items-start py-2.5"
                onSelect={() => {
                  if (!n.isRead) readOne.mutate(n.id);
                  if (n.link) navigate(n.link);
                }}
              >
                <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.isRead ? 'bg-transparent' : 'bg-brand-600')} />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{n.title}</span>
                  <span className="line-clamp-2 block text-xs font-normal text-muted">{n.message}</span>
                  <span className="mt-0.5 block text-[11px] font-normal text-stone-400">{timeAgo(n.createdAt)}</span>
                </span>
              </DropdownItem>
            ))
          )}
        </div>
        <div className="border-t border-line p-1.5">
          <DropdownItem className="justify-center text-brand-700" onSelect={() => navigate('/notifications')}>
            View all notifications
          </DropdownItem>
        </div>
      </DropdownContent>
    </Dropdown>
  );
}

export function Navbar() {
  const { user, isAdmin } = useAuth();
  const { data: counts } = useCounts();
  const { data: categories = [] } = useCategories();
  const logout = useLogout();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const doLogout = () =>
    logout.mutate(undefined, {
      onSuccess: () => {
        toast.success('You have been logged out');
        navigate('/');
      },
    });

  const navLink = ({ isActive }: { isActive: boolean }) =>
    cn('rounded-full px-3.5 py-2 text-sm font-semibold transition-colors', isActive ? 'bg-brand-50 text-brand-800' : 'text-ink hover:bg-stone-100');

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-white/90 backdrop-blur-md">
      <div className="container-page flex h-16 items-center gap-4">
        <Logo />
        <nav className="ml-4 hidden items-center gap-1 md:flex" aria-label="Main">
          <NavLink to="/explore" className={navLink} end>
            Explore
          </NavLink>
          <Dropdown>
            <DropdownTrigger className="rounded-full px-3.5 py-2 text-sm font-semibold text-ink hover:bg-stone-100">Categories</DropdownTrigger>
            <DropdownContent align="start" className="w-64">
              {categories.map((c) => (
                <DropdownItem key={c.id} onSelect={() => navigate(`/explore?category=${c.slug}`)}>
                  <CategoryIcon name={c.icon} />
                  <span className="flex-1">{c.name}</span>
                  <span className="text-xs text-muted">{c.listingCount}</span>
                </DropdownItem>
              ))}
            </DropdownContent>
          </Dropdown>
          <NavLink to="/listings/new" className={navLink}>
            List your item
          </NavLink>
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <NavSearch />
          <Link to="/explore" className="rounded-full p-2.5 hover:bg-stone-100 lg:hidden" aria-label="Search">
            <Search className="size-5" />
          </Link>
          {user ? (
            <>
              <Link to="/dashboard/messages" className="relative hidden rounded-full p-2.5 hover:bg-stone-100 sm:block" aria-label={`Messages${counts?.messages ? ` (${counts.messages} unread)` : ''}`}>
                <MessageCircle className="size-5" />
                <CountBadge count={counts?.messages} />
              </Link>
              <NotificationsMenu count={counts?.notifications} />
              <Dropdown>
                <DropdownTrigger className="ml-1 rounded-full ring-offset-2 focus-visible:ring-2 focus-visible:ring-brand-600" aria-label="Account menu">
                  <UserAvatar name={user.name} src={user.profileImage} className="size-9" />
                </DropdownTrigger>
                <DropdownContent>
                  <DropdownLabel>
                    <p className="text-sm font-bold">{user.name}</p>
                    <p className="truncate text-xs font-normal text-muted">{user.email}</p>
                  </DropdownLabel>
                  <DropdownSeparator />
                  <DropdownItem onSelect={() => navigate('/dashboard')}>
                    <LayoutDashboard /> Dashboard
                  </DropdownItem>
                  <DropdownItem onSelect={() => navigate('/dashboard/rentals')}>
                    <CalendarCheck /> My rentals
                  </DropdownItem>
                  <DropdownItem onSelect={() => navigate('/dashboard/listings')}>
                    <Package /> My listings
                  </DropdownItem>
                  <DropdownItem onSelect={() => navigate('/dashboard/favorites')}>
                    <Heart /> Favorites
                  </DropdownItem>
                  <DropdownItem onSelect={() => navigate('/dashboard/settings')}>
                    <Settings /> Account settings
                  </DropdownItem>
                  {isAdmin && (
                    <DropdownItem onSelect={() => navigate('/admin')}>
                      <Shield /> Admin
                    </DropdownItem>
                  )}
                  <DropdownSeparator />
                  <DropdownItem onSelect={doLogout} className="text-red-600 [&_svg]:text-red-500">
                    <LogOut /> Log out
                  </DropdownItem>
                </DropdownContent>
              </Dropdown>
            </>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Button variant="ghost" asChild>
                <Link to="/login">Log in</Link>
              </Button>
              <Button asChild>
                <Link to="/register">Sign up</Link>
              </Button>
            </div>
          )}
          <button className="rounded-full p-2.5 hover:bg-stone-100 md:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <Menu className="size-5" />
          </button>
        </div>
      </div>

      {/* Mobile navigation sheet */}
      <DialogPrimitive.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/40 md:hidden" />
          <DialogPrimitive.Content className="fixed inset-y-0 right-0 z-50 flex w-[85%] max-w-sm flex-col bg-white p-5 shadow-lift data-[state=open]:animate-fade-in md:hidden">
            <div className="flex items-center justify-between">
              <DialogPrimitive.Title asChild>
                <span>
                  <Logo />
                </span>
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="sr-only">Site navigation</DialogPrimitive.Description>
              <DialogPrimitive.Close className="rounded-full p-2 hover:bg-stone-100" aria-label="Close menu">
                <X className="size-5" />
              </DialogPrimitive.Close>
            </div>
            <nav className="mt-6 flex flex-col gap-1 overflow-y-auto" onClick={(e) => (e.target as HTMLElement).closest('a') && setMobileOpen(false)}>
              <MobileLink to="/explore">Explore</MobileLink>
              <MobileLink to="/listings/new">
                <Plus className="size-4" /> List your item
              </MobileLink>
              <p className="mt-4 px-3 text-xs font-bold uppercase tracking-wide text-muted">Categories</p>
              {categories.map((c) => (
                <MobileLink key={c.id} to={`/explore?category=${c.slug}`}>
                  <CategoryIcon name={c.icon} className="size-4 text-muted" /> {c.name}
                </MobileLink>
              ))}
              {user && (
                <>
                  <p className="mt-4 px-3 text-xs font-bold uppercase tracking-wide text-muted">Account</p>
                  <MobileLink to="/dashboard">Dashboard</MobileLink>
                  <MobileLink to="/dashboard/messages">
                    Messages {Boolean(counts?.messages) && <span className="ml-auto rounded-full bg-red-500 px-2 text-xs text-white">{counts?.messages}</span>}
                  </MobileLink>
                  <MobileLink to="/notifications">
                    Notifications{' '}
                    {Boolean(counts?.notifications) && <span className="ml-auto rounded-full bg-red-500 px-2 text-xs text-white">{counts?.notifications}</span>}
                  </MobileLink>
                  {isAdmin && <MobileLink to="/admin">Admin</MobileLink>}
                </>
              )}
            </nav>
            <div className="mt-auto flex flex-col gap-2 pt-6">
              {user ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setMobileOpen(false);
                    doLogout();
                  }}
                >
                  <LogOut /> Log out
                </Button>
              ) : (
                <>
                  <Button asChild onClick={() => setMobileOpen(false)}>
                    <Link to="/register">Sign up</Link>
                  </Button>
                  <Button variant="outline" asChild onClick={() => setMobileOpen(false)}>
                    <Link to="/login">Log in</Link>
                  </Button>
                </>
              )}
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </header>
  );
}

function MobileLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[15px] font-semibold hover:bg-stone-100">
      {children}
    </Link>
  );
}
