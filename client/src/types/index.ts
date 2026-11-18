export type Role = 'USER' | 'ADMIN';
export type ItemCondition = 'BRAND_NEW' | 'LIKE_NEW' | 'GOOD' | 'FAIR';
export type ListingStatus = 'ACTIVE' | 'PAUSED' | 'REMOVED' | 'DELETED';
export type BookingStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | 'ACTIVE' | 'COMPLETED';
export type PaymentStatus = 'UNPAID' | 'SIMULATED_PAID' | 'SIMULATED_REFUNDED';
export type FulfillmentMethod = 'PICKUP' | 'DELIVERY';

export interface PublicUser {
  id: string;
  name: string;
  profileImage: string | null;
  city: string;
  district: string | null;
  bio: string | null;
  ratingAvg: number;
  ratingCount: number;
  createdAt: string;
}

export interface OAuthProvider {
  key: string;
  label: string;
}

export interface Me extends PublicUser {
  hasPassword: boolean;
  /** Provider keys, e.g. ["google"]. */
  connectedProviders: string[];
  email: string;
  phone: string;
  province: string | null;
  role: Role;
  status: 'ACTIVE' | 'SUSPENDED';
  notifyBookings: boolean;
  notifyMessages: boolean;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string;
  description: string | null;
  listingCount: number;
}

export interface Province {
  name: string;
  cities: { name: string; districts: string[] }[];
}

export interface ListingCard {
  id: string;
  title: string;
  dailyPrice: number;
  weeklyPrice: number | null;
  monthlyPrice: number | null;
  securityDeposit: number;
  condition: ItemCondition;
  city: string;
  district: string | null;
  status: ListingStatus;
  ratingAvg: number;
  reviewCount: number;
  pickupAvailable: boolean;
  deliveryAvailable: boolean;
  createdAt: string;
  image: string | null;
  category: { id: string; name: string; slug: string };
  owner: { id: string; name: string; profileImage: string | null; ratingAvg: number; ratingCount: number };
  availableToday: boolean;
  availableFrom: string | null;
  isFavorited: boolean;
}

export interface MyListing extends ListingCard {
  bookingCount: number;
  favoriteCount: number;
  pendingRequests: number;
}

export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface Review {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
  reviewer: { id: string; name: string; profileImage: string | null };
  listing?: { id: string; title: string };
}

export interface ListingDetail {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  subcategory: string | null;
  dailyPrice: number;
  weeklyPrice: number | null;
  monthlyPrice: number | null;
  securityDeposit: number;
  condition: ItemCondition;
  province: string;
  city: string;
  district: string | null;
  address: string;
  pickupAvailable: boolean;
  deliveryAvailable: boolean;
  deliveryFee: number;
  minRentalDays: number;
  maxRentalDays: number | null;
  status: ListingStatus;
  ratingAvg: number;
  reviewCount: number;
  createdAt: string;
  images: { id: string; imageUrl: string; displayOrder: number }[];
  category: { id: string; name: string; slug: string };
  owner: PublicUser & { listingCount: number };
  blockedDates?: (DateRange & { note: string | null })[];
  favoriteCount: number;
  completedRentals: number;
  unavailable: (DateRange & { reason: 'booked' | 'blocked' })[];
  isFavorited: boolean;
  isOwner: boolean;
  reviews: Review[];
}

export interface PriceBreakdown {
  rentalDays: number;
  dailyPrice: number;
  rentalSubtotal: number;
  discount: number;
  deliveryFee: number;
  securityDeposit: number;
  rentalTotal: number;
  totalDue: number;
}

export interface Quote {
  available: boolean;
  reason: string | null;
  breakdown: PriceBreakdown | null;
}

type BookingParty = PublicUser & { phone: string | null };

export interface Booking {
  id: string;
  listingId: string;
  renterId: string;
  ownerId: string;
  startDate: string;
  endDate: string;
  rentalDays: number;
  fulfillmentMethod: FulfillmentMethod;
  dailyPriceSnapshot: number;
  rentalPriceSnapshot: number;
  depositSnapshot: number;
  deliveryFeeSnapshot: number;
  totalPrice: number;
  listingTitleSnapshot: string;
  renterNote: string | null;
  ownerNote: string | null;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  createdAt: string;
  updatedAt: string;
  listing: { id: string; title: string; city: string; district: string | null; address: string; status: ListingStatus; image: string | null };
  renter: BookingParty;
  owner: BookingParty;
  review: { id: string; rating: number; comment: string; createdAt: string } | null;
  viewerRole: 'owner' | 'renter' | 'admin';
  canReview: boolean;
  isExpired: boolean;
}

export interface Overview {
  activeRentals: number;
  upcomingRentals: number;
  pendingIncoming: number;
  pendingOutgoing: number;
  listings: { total: number; active: number; paused: number };
  totalEarnings: number;
  completedAsOwner: number;
  recent: Booking[];
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ChatUser {
  id: string;
  name: string;
  profileImage: string | null;
  city: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  readAt: string | null;
  createdAt: string;
}

export interface ConversationSummary {
  id: string;
  updatedAt: string;
  otherUser: ChatUser | null;
  lastMessage: Message | null;
  unreadCount: number;
  listing: { id: string; title: string; image: string | null } | null;
}

export interface ConversationDetail {
  id: string;
  otherUser: ChatUser | null;
  listing: { id: string; title: string; dailyPrice: number; image: string | null } | null;
  messages: Message[];
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface PublicProfile {
  user: PublicUser & { completedRentals: number };
  listings: ListingCard[];
  reviews: Review[];
}
