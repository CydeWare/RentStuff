import 'dotenv/config';
import { z } from 'zod';

const optional = z
  .string()
  .optional()
  .transform((v) => v?.trim() || undefined);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  /** Public URL users open in the browser. Social-login redirect URIs are built from it. */
  APP_URL: optional,
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  OAUTH_GOOGLE_CLIENT_ID: optional,
  OAUTH_GOOGLE_CLIENT_SECRET: optional,
  OAUTH_FACEBOOK_CLIENT_ID: optional,
  OAUTH_FACEBOOK_CLIENT_SECRET: optional,
  OAUTH_GITHUB_CLIENT_ID: optional,
  OAUTH_GITHUB_CLIENT_SECRET: optional,
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:');
  for (const issue of parsed.error.issues) console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  process.exit(1);
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

export const clientOrigins = env.CLIENT_URL.split(',').map((o) => o.trim()).filter(Boolean);

/** e.g. http://localhost:5173 in development (the Vite proxy forwards /api to the API). */
export const appUrl = (env.APP_URL ?? clientOrigins[0] ?? 'http://localhost:5173').replace(/\/+$/, '');

export const cloudinaryEnabled = Boolean(
  env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET,
);
