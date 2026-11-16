import { NavLink, Outlet } from 'react-router';
import { CalendarCheck, Heart, Inbox, LayoutDashboard, MessageCircle, Package, Settings, type LucideIcon } from 'lucide-react';
import { useCounts } from '@/hooks/useCounts';
import { cn } from '@/utils/cn';

const items: { to: string; label: string; icon: LucideIcon; end?: boolean; badge?: 'messages' }[] = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/dashboard/rentals', label: 'My rentals', icon: CalendarCheck },
  { to: '/dashboard/listings', label: 'My listings', icon: Package },
  { to: '/dashboard/requests', label: 'Booking requests', icon: Inbox },
  { to: '/dashboard/favorites', label: 'Favorites', icon: Heart },
  { to: '/dashboard/messages', label: 'Messages', icon: MessageCircle, badge: 'messages' },
  { to: '/dashboard/settings', label: 'Account settings', icon: Settings },
];

export function SideNav({
  items: navItems,
  badges = {},
}: {
  items: { to: string; label: string; icon: LucideIcon; end?: boolean; badge?: string }[];
  badges?: Record<string, number | undefined>;
}) {
  return (
    <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-2 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0" aria-label="Section">
      {navItems.map(({ to, label, icon: Icon, end, badge }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            cn(
              'flex shrink-0 items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors',
              isActive ? 'bg-brand-700 text-white' : 'text-ink hover:bg-stone-100',
            )
          }
        >
          <Icon className="size-[18px]" />
          {label}
          {badge && Boolean(badges[badge]) && (
            <span className="ml-auto rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white">{badges[badge]}</span>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

export function DashboardLayout() {
  const { data: counts } = useCounts();
  return (
    <div className="container-page py-8 lg:py-10">
      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <SideNav items={items} badges={{ messages: counts?.messages }} />
        </aside>
        <div className="min-w-0 animate-fade-in">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
