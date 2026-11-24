import type { Server } from 'node:http';
import { z } from 'zod';
import { createApp } from './app.js';
import { env, isProduction } from './config/env.js';
import { loadTransformConfig } from './config/transform.js';
import { usersRepository } from './repositories/usersRepository.js';
import { usersService } from './services/usersService.js';

const seedSchema = z.object({
  ADMIN_EMAIL: z.string().trim().toLowerCase().pipe(z.email()),
  ADMIN_PASSWORD: z
    .string()
    .min(12)
    .refine((value) => /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value)),
  ADMIN_NAME: z.string().trim().min(1).max(120).default('Site Administrator')
});

async function ensureFirstAdmin(): Promise<void> {
  if (!isProduction) {
    return;
  }
  const existing = await usersRepository.findAll();
  if (existing.length > 0) {
    return;
  }
  const parsed = seedSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error('Production has no administrator, and ADMIN_EMAIL / ADMIN_PASSWORD in .env are missing or too weak.');
  }
  const { user } = await usersService.upsertSeedAdmin(parsed.data.ADMIN_EMAIL, parsed.data.ADMIN_NAME, parsed.data.ADMIN_PASSWORD);
  console.info(`Created administrator ${user.email}.`);
}

async function start(): Promise<Server> {
  await ensureFirstAdmin();
  const config = await loadTransformConfig();
  const app = createApp(config);
  const port = env.PORT ?? config.port;
  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      console.info(`${config.siteName} listening on http://localhost:${port}`);
      resolve(server);
    });
    server.once('error', reject);
  });
}

function shutdown(server: Server, signal: string): void {
  console.info(`${signal} received, closing server`);
  server.close((error) => {
    if (error) {
      console.error('Error while closing server', error);
      process.exit(1);
    }
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection', reason);
});

try {
  const server = await start();
  process.once('SIGINT', () => shutdown(server, 'SIGINT'));
  process.once('SIGTERM', () => shutdown(server, 'SIGTERM'));
} catch (error) {
  console.error('Server failed to start', error);
  process.exit(1);
}
