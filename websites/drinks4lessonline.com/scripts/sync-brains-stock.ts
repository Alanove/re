/**
 * Run the Brains stock sync once.
 * Usage: npm run brains:sync
 */
import dotenv from 'dotenv';
import * as path from 'path';

const nodeEnv = process.env.NODE_ENV || 'development';
dotenv.config({ path: path.resolve(process.cwd(), `.env.${nodeEnv}`) });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { db } from '../src/config/database';
import { syncBrainsStock } from '../src/services/brainsSyncService';

syncBrainsStock()
  .then(async () => {
    await db.close();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error(error);
    await db.close();
    process.exit(1);
  });
