import { env, cloudinaryEnabled } from './config/env.js';
import { prisma } from './config/prisma.js';
import { createApp } from './app.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`Rentora API listening on http://localhost:${env.PORT}`);
  console.log(`Image storage: ${cloudinaryEnabled ? 'Cloudinary' : 'local disk (server/uploads) - set CLOUDINARY_* to use Cloudinary'}`);
});

async function shutdown() {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
