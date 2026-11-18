import { createBrowserRouter } from 'react-router';
import { MainLayout } from '@/layouts/MainLayout';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { AdminLayout } from '@/layouts/AdminLayout';
import { GuestOnly, RequireAdmin, RequireAuth } from './guards';
import { HomePage } from '@/pages/HomePage';
import { ExplorePage } from '@/pages/ExplorePage';
import { ItemDetailsPage } from '@/pages/ItemDetailsPage';
import { CompleteSignupPage, LoginPage, RegisterPage } from '@/pages/AuthPages';
import { ListingFormPage } from '@/pages/ListingFormPage';
import { InfoPage, NotFoundPage, NotificationsPage, PublicProfilePage } from '@/pages/MiscPages';
import { OverviewPage } from '@/pages/dashboard/OverviewPage';
import { BookingRequestsPage, MyRentalsPage } from '@/pages/dashboard/BookingsPages';
import { MyListingsPage } from '@/pages/dashboard/MyListingsPage';
import { FavoritesPage } from '@/pages/dashboard/FavoritesPage';
import { MessagesPage } from '@/pages/dashboard/MessagesPage';
import { SettingsPage } from '@/pages/dashboard/SettingsPage';
import {
  AdminBookingsPage,
  AdminListingsPage,
  AdminOverviewPage,
  AdminReportsPage,
  AdminUsersPage,
} from '@/pages/admin/AdminPages';

export const router = createBrowserRouter([
  {
    element: <GuestOnly />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/complete-signup', element: <CompleteSignupPage /> },
    ],
  },
  {
    element: <MainLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/explore', element: <ExplorePage /> },
      { path: '/items/:id', element: <ItemDetailsPage /> },
      { path: '/users/:id', element: <PublicProfilePage /> },
      { path: '/about', element: <InfoPage page="about" /> },
      { path: '/help', element: <InfoPage page="help" /> },
      { path: '/contact', element: <InfoPage page="contact" /> },
      { path: '/terms', element: <InfoPage page="terms" /> },
      { path: '/privacy', element: <InfoPage page="privacy" /> },
      {
        element: <RequireAuth />,
        children: [
          { path: '/listings/new', element: <ListingFormPage /> },
          { path: '/listings/:id/edit', element: <ListingFormPage /> },
          { path: '/notifications', element: <NotificationsPage /> },
          {
            path: '/dashboard',
            element: <DashboardLayout />,
            children: [
              { index: true, element: <OverviewPage /> },
              { path: 'rentals', element: <MyRentalsPage /> },
              { path: 'listings', element: <MyListingsPage /> },
              { path: 'requests', element: <BookingRequestsPage /> },
              { path: 'favorites', element: <FavoritesPage /> },
              { path: 'messages', element: <MessagesPage /> },
              { path: 'messages/:id', element: <MessagesPage /> },
              { path: 'settings', element: <SettingsPage /> },
            ],
          },
        ],
      },
      {
        element: <RequireAdmin />,
        children: [
          {
            path: '/admin',
            element: <AdminLayout />,
            children: [
              { index: true, element: <AdminOverviewPage /> },
              { path: 'users', element: <AdminUsersPage /> },
              { path: 'listings', element: <AdminListingsPage /> },
              { path: 'bookings', element: <AdminBookingsPage /> },
              { path: 'reports', element: <AdminReportsPage /> },
            ],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
