import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { clientOrigins, isProduction, isTest } from './config/env.js';
import { router } from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { UPLOAD_DIR } from './services/storage.service.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(
    helmet({
      // Allow the client (different origin in development) to display uploaded images.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(
    cors({
      origin: (origin, cb) => {
        // Same-origin / server-to-server requests have no Origin header.
        if (!origin || clientOrigins.includes(origin)) cb(null, true);
        else cb(null, false);
      },
      credentials: true,
    }),
  );
  if (!isTest) app.use(morgan(isProduction ? 'combined' : 'dev'));
  app.use(express.json({ limit: '200kb' }));
  app.use(cookieParser());

  // Locally stored uploads (development fallback when Cloudinary is not configured).
  app.use(
    '/uploads',
    express.static(UPLOAD_DIR, {
      maxAge: '7d',
      setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
    }),
  );

  app.use('/api', apiLimiter, router);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
