import { api } from './api';
import type {
  Booking,
  BookingStatus,
  Category,
  ConversationDetail,
  ConversationSummary,
  ListingCard,
  ListingDetail,
  Me,
  Message,
  MyListing,
  Notification,
  Overview,
  Paged,
  Province,
  PublicProfile,
  Quote,
} from '@/types';

export interface SearchParams {
  q?: string;
  category?: string;
  city?: string;
  minPrice?: number;
  maxPrice?: number;
  condition?: string;
  startDate?: string;
  endDate?: string;
  duration?: number;
  delivery?: string;
  sort?: string;
  page?: number;
  limit?: number;
}

export interface ListingInput {
  title: string;
  description: string;
  categoryId: string;
  subcategory?: string | null;
  dailyPrice: number;
  weeklyPrice: number | null;
  monthlyPrice: number | null;
  securityDeposit: number;
  condition: string;
  province: string;
  city: string;
  district?: string | null;
  address: string;
  pickupAvailable: boolean;
  deliveryAvailable: boolean;
  deliveryFee: number;
  minRentalDays: number;
  maxRentalDays: number | null;
  images: string[];
  blockedDates: { startDate: string; endDate: string; note?: string }[];
}

export const authApi = {
  me: () => api.get<{ user: Me | null }>('/auth/me'),
  login: (body: { email: string; password: string }) => api.post<{ user: Me }>('/auth/login', body),
  register: (body: Record<string, unknown>) => api.post<{ user: Me }>('/auth/register', body),
  logout: () => api.post<{ ok: true }>('/auth/logout'),
};

export const metaApi = {
  categories: () => api.get<{ items: Category[] }>('/meta/categories'),
  locations: () => api.get<{ items: Province[] }>('/meta/locations'),
};

export const listingApi = {
  search: (params: SearchParams) => api.get<Paged<ListingCard>>('/listings', { ...params }),
  featured: (type: 'popular' | 'recent' | 'recommended', city?: string, limit = 8) =>
    api.get<{ items: ListingCard[] }>('/listings/featured', { type, city, limit }),
  get: (id: string) => api.get<{ listing: ListingDetail }>(`/listings/${id}`),
  quote: (id: string, q: { startDate: string; endDate: string; fulfillmentMethod: string }) =>
    api.get<Quote>(`/listings/${id}/quote`, q),
  mine: () => api.get<{ items: MyListing[] }>('/listings/mine'),
  create: (body: ListingInput) => api.post<{ listing: { id: string } }>('/listings', body),
  update: (id: string, body: ListingInput) => api.put<{ listing: { id: string } }>(`/listings/${id}`, body),
  setStatus: (id: string, status: 'ACTIVE' | 'PAUSED') => api.patch(`/listings/${id}/status`, { status }),
  remove: (id: string) => api.delete(`/listings/${id}`),
  favorite: (id: string) => api.post(`/listings/${id}/favorite`),
  unfavorite: (id: string) => api.delete(`/listings/${id}/favorite`),
  report: (id: string, body: { reason: string; description?: string }) => api.post(`/listings/${id}/report`, body),
};

export const uploadApi = {
  images: (files: File[]) => {
    const fd = new FormData();
    files.forEach((f) => fd.append('images', f));
    return api.post<{ urls: string[] }>('/uploads/images', fd);
  },
  avatar: (file: File) => {
    const fd = new FormData();
    fd.append('image', file);
    return api.post<{ user: Me }>('/me/avatar', fd);
  },
};

export const meApi = {
  favorites: () => api.get<{ items: ListingCard[] }>('/me/favorites'),
  overview: () => api.get<Overview>('/me/overview'),
  counts: () => api.get<{ notifications: number; messages: number }>('/me/counts'),
  updateProfile: (body: Record<string, unknown>) => api.put<{ user: Me }>('/me/profile', body),
  changePassword: (body: { currentPassword: string; newPassword: string }) => api.put('/me/password', body),
  updatePrefs: (body: { notifyBookings: boolean; notifyMessages: boolean }) =>
    api.put<{ user: Me }>('/me/notification-preferences', body),
};

export const userApi = {
  profile: (id: string) => api.get<PublicProfile>(`/users/${id}`),
};

export type BookingAction = 'accept' | 'reject' | 'cancel' | 'start' | 'complete' | 'simulate_payment';

export const bookingApi = {
  list: (role: 'renter' | 'owner', status?: BookingStatus[]) =>
    api.get<{ items: Booking[] }>('/bookings', { role, status: status?.join(',') }),
  get: (id: string) => api.get<{ booking: Booking }>(`/bookings/${id}`),
  create: (body: { listingId: string; startDate: string; endDate: string; fulfillmentMethod: string; note?: string }) =>
    api.post<{ booking: Booking }>('/bookings', body),
  action: (id: string, action: BookingAction, note?: string) =>
    api.post<{ booking: Booking }>(`/bookings/${id}/actions`, { action, note }),
  review: (id: string, body: { rating: number; comment: string }) => api.post(`/bookings/${id}/review`, body),
};

export const messageApi = {
  list: () => api.get<{ items: ConversationSummary[] }>('/conversations'),
  get: (id: string) => api.get<{ conversation: ConversationDetail }>(`/conversations/${id}`),
  start: (body: { recipientId: string; listingId?: string; content: string }) =>
    api.post<{ conversationId: string }>('/conversations', body),
  send: (id: string, content: string) => api.post<{ message: Message }>(`/conversations/${id}/messages`, { content }),
};

export const notificationApi = {
  list: (page = 1) => api.get<Paged<Notification> & { unread: number }>('/notifications', { page, limit: 20 }),
  read: (id: string) => api.post(`/notifications/${id}/read`),
  readAll: () => api.post('/notifications/read-all'),
};

export const adminApi = {
  stats: () => api.get<AdminStats>('/admin/stats'),
  users: (q: AdminQuery) => api.get<Paged<AdminUser>>('/admin/users', { ...q }),
  setUserStatus: (id: string, status: 'ACTIVE' | 'SUSPENDED') => api.patch(`/admin/users/${id}/status`, { status }),
  listings: (q: AdminQuery) => api.get<Paged<AdminListing>>('/admin/listings', { ...q }),
  setListingStatus: (id: string, status: 'ACTIVE' | 'REMOVED') => api.patch(`/admin/listings/${id}/status`, { status }),
  bookings: (q: AdminQuery) => api.get<Paged<AdminBooking>>('/admin/bookings', { ...q }),
  reports: (q: AdminQuery) => api.get<Paged<AdminReport>>('/admin/reports', { ...q }),
  updateReport: (id: string, body: { status: string; removeListing?: boolean }) => api.patch(`/admin/reports/${id}`, body),
};

export interface AdminQuery {
  page?: number;
  q?: string;
  status?: string;
}

export interface AdminStats {
  users: number;
  suspendedUsers: number;
  newUsers7d: number;
  listings: Record<string, number>;
  bookings: Record<string, number>;
  openReports: number;
  completedRentalValue: number;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  role: 'USER' | 'ADMIN';
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
  profileImage: string | null;
  ratingAvg: number;
  ratingCount: number;
  _count: { listings: number; rentals: number };
}

export interface AdminListing {
  id: string;
  title: string;
  status: 'ACTIVE' | 'PAUSED' | 'REMOVED' | 'DELETED';
  dailyPrice: number;
  city: string;
  createdAt: string;
  owner: { id: string; name: string; email: string };
  category: { name: string };
  images: { imageUrl: string }[];
  _count: { reports: number; bookings: number };
}

export interface AdminBooking {
  id: string;
  listingId: string;
  listingTitleSnapshot: string;
  startDate: string;
  endDate: string;
  rentalDays: number;
  totalPrice: number;
  status: BookingStatus;
  paymentStatus: string;
  createdAt: string;
  renter: { id: string; name: string };
  owner: { id: string; name: string };
}

export interface AdminReport {
  id: string;
  reason: string;
  description: string | null;
  status: 'OPEN' | 'RESOLVED' | 'DISMISSED';
  createdAt: string;
  reporter: { id: string; name: string; email: string };
  listing: { id: string; title: string; status: string; owner: { id: string; name: string } };
}
