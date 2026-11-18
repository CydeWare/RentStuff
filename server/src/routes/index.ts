import { Router } from 'express';
import * as auth from '../controllers/auth.controller.js';
import * as listings from '../controllers/listing.controller.js';
import * as bookings from '../controllers/booking.controller.js';
import * as users from '../controllers/user.controller.js';
import * as misc from '../controllers/misc.controller.js';
import * as admin from '../controllers/admin.controller.js';
import { optionalAuth, requireAdmin, requireAuth } from '../middleware/auth.js';
import { authLimiter, sensitiveLimiter } from '../middleware/rateLimit.js';
import { imageUpload, MAX_IMAGES_PER_UPLOAD } from '../middleware/upload.js';

export const router = Router();

router.get('/health', (_req, res) => {
  res.json({ ok: true });
});

// ---- Auth ----
router.post('/auth/register', authLimiter, auth.register);
router.post('/auth/login', authLimiter, auth.login);
router.post('/auth/logout', auth.logout);
router.get('/auth/me', optionalAuth, auth.me);
// Social login. The literal routes come before /:provider/* so they are not captured.
router.get('/auth/oauth/signup', auth.oauthPendingSignup);
router.post('/auth/oauth/complete', authLimiter, auth.oauthComplete);
router.get('/auth/oauth/:provider/start', authLimiter, optionalAuth, auth.oauthStart);
router.get('/auth/oauth/:provider/callback', authLimiter, optionalAuth, auth.oauthCallback);

// ---- Meta ----
router.get('/meta/categories', misc.categories);
router.get('/meta/locations', misc.locations);
router.get('/meta/config', misc.config);

// ---- Listings ----
router.get('/listings', optionalAuth, listings.search);
router.get('/listings/featured', optionalAuth, listings.featured);
router.get('/listings/mine', requireAuth, listings.mine);
router.get('/listings/:id', optionalAuth, listings.getOne);
router.get('/listings/:id/quote', optionalAuth, listings.quote);
router.post('/listings', requireAuth, sensitiveLimiter, listings.create);
router.put('/listings/:id', requireAuth, listings.update);
router.patch('/listings/:id/status', requireAuth, listings.setStatus);
router.delete('/listings/:id', requireAuth, listings.remove);
router.post('/listings/:id/report', requireAuth, sensitiveLimiter, listings.report);
router.post('/listings/:id/favorite', requireAuth, listings.favorite);
router.delete('/listings/:id/favorite', requireAuth, listings.unfavorite);

// ---- Uploads ----
router.post('/uploads/images', requireAuth, sensitiveLimiter, imageUpload.array('images', MAX_IMAGES_PER_UPLOAD), misc.uploadImages);

// ---- Current user ----
router.get('/me/favorites', requireAuth, listings.favorites);
router.get('/me/overview', requireAuth, bookings.overview);
router.get('/me/counts', requireAuth, misc.counts);
router.put('/me/profile', requireAuth, users.updateProfile);
router.put('/me/password', requireAuth, authLimiter, users.changePassword);
router.delete('/me/oauth/:provider', requireAuth, auth.oauthDisconnect);
router.put('/me/notification-preferences', requireAuth, users.updatePrefs);
router.post('/me/avatar', requireAuth, sensitiveLimiter, imageUpload.single('image'), users.uploadAvatar);

// ---- Public profiles ----
router.get('/users/:id', optionalAuth, users.publicProfile);

// ---- Bookings ----
router.get('/bookings', requireAuth, bookings.list);
router.post('/bookings', requireAuth, sensitiveLimiter, bookings.create);
router.get('/bookings/:id', requireAuth, bookings.getOne);
router.post('/bookings/:id/actions', requireAuth, sensitiveLimiter, bookings.action);
router.post('/bookings/:id/review', requireAuth, sensitiveLimiter, bookings.review);

// ---- Messages ----
router.get('/conversations', requireAuth, misc.conversations);
router.post('/conversations', requireAuth, sensitiveLimiter, misc.startConversation);
router.get('/conversations/:id', requireAuth, misc.conversation);
router.post('/conversations/:id/messages', requireAuth, sensitiveLimiter, misc.sendMessage);

// ---- Notifications ----
router.get('/notifications', requireAuth, misc.notifications);
router.post('/notifications/read-all', requireAuth, misc.markAllNotificationsRead);
router.post('/notifications/:id/read', requireAuth, misc.markNotificationRead);

// ---- Admin (role-based access control on every route) ----
const adminRouter = Router();
adminRouter.use(requireAdmin);
adminRouter.get('/stats', admin.stats);
adminRouter.get('/users', admin.users);
adminRouter.patch('/users/:id/status', admin.setUserStatus);
adminRouter.get('/listings', admin.listings);
adminRouter.patch('/listings/:id/status', admin.setListingStatus);
adminRouter.get('/bookings', admin.bookings);
adminRouter.get('/reports', admin.reports);
adminRouter.patch('/reports/:id', admin.updateReport);
router.use('/admin', adminRouter);
