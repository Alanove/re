import type { Server } from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { loadTransformConfig } from './config/transform.js';
import { fuelPriceService } from './services/fuelPriceService.js';

async function start(): Promise<Server> {
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

function shutdown(server: Server, signal: string, stopJobs: () => void): void {
  console.info(`${signal} received, closing server`);
  stopJobs();
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
  const stopFuelPriceSync = fuelPriceService.startScheduler();
  process.once('SIGINT', () => shutdown(server, 'SIGINT', stopFuelPriceSync));
  process.once('SIGTERM', () => shutdown(server, 'SIGTERM', stopFuelPriceSync));
} catch (error) {
  console.error('Server failed to start', error);
  process.exit(1);
}
