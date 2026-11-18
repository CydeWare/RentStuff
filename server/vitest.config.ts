import { defineConfig } from 'vitest/config';
import { config as loadEnv } from 'dotenv';

loadEnv();

const testDb = process.env.TEST_DATABASE_URL;

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/globalSetup.ts'],
    // Integration tests share one database, so run files sequentially.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      NODE_ENV: 'test',
      ...(testDb ? { DATABASE_URL: testDb } : {}),
      JWT_SECRET: process.env.JWT_SECRET ?? 'test-secret-test-secret-test-secret',
      APP_URL: 'http://localhost:5173',
      // Fake credentials so the providers are "enabled"; provider HTTP calls are mocked in tests.
      OAUTH_GOOGLE_CLIENT_ID: 'test-google-id',
      OAUTH_GOOGLE_CLIENT_SECRET: 'test-google-secret',
      OAUTH_FACEBOOK_CLIENT_ID: 'test-facebook-id',
      OAUTH_FACEBOOK_CLIENT_SECRET: 'test-facebook-secret',
      OAUTH_GITHUB_CLIENT_ID: '',
      OAUTH_GITHUB_CLIENT_SECRET: '',
    },
  },
});
