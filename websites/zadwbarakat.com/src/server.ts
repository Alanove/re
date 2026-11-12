import type { Server } from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { loadTransformConfig } from './config/transform.js';
import { searchService } from './services/searchService.js';

async function start(): Promise<Server> {
  const config = await loadTransformConfig();
  const app = createApp(config);
  const port = env.PORT ?? config.port;
  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      console.info(`${config.siteName} listening on http://localhost:${port}`);
      searchService.warm().catch((error: unknown) => {
        console.error('Search index could not be built; it will be retried on the first search', error);
      });
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
