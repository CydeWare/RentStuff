import { Outlet } from 'react-router';
import { BarChart3, CalendarRange, Flag, Package, Users } from 'lucide-react';
import { SideNav } from './DashboardLayout';

const items = [
  { to: '/admin', label: 'Overview', icon: BarChart3, end: true },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/listings', label: 'Listings', icon: Package },
  { to: '/admin/bookings', label: 'Bookings', icon: CalendarRange },
  { to: '/admin/reports', label: 'Reports', icon: Flag },
];

export function AdminLayout() {
  return (
    <div className="container-page py-8 lg:py-10">
      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <p className="mb-3 hidden px-3.5 text-xs font-bold uppercase tracking-wide text-muted lg:block">Admin console</p>
          <SideNav items={items} />
        </aside>
        <div className="min-w-0 animate-fade-in">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
