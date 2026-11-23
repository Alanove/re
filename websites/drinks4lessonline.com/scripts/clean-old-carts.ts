/**
 * Standalone script to clean old shopping carts (for manual or cron use).
 * The app runs its own daily cleanup: 14 days for guest carts, 365 days for customer carts.
 * This script only cleans guest carts by default; use for one-off or override scheduling.
 *
 * Usage:
 *   npx ts-node scripts/clean-old-carts.ts           # default: guest carts older than 30 days
 *   npx ts-node scripts/clean-old-carts.ts --days=14 # guest carts older than 14 days
 *   npx ts-node scripts/clean-old-carts.ts --dry-run # show what would be deleted
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

const nodeEnv = process.env.NODE_ENV || 'development';
const envPath = path.resolve(__dirname, '..', `.env.${nodeEnv}`);
dotenv.config({ path: envPath });

// Fallback if .env.{env} doesn't exist
if (!process.env.DB_HOST) {
  dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
}

import { db } from '../src/config/database';

const DEFAULT_DAYS = 30;

function parseArgs(): { days: number; dryRun: boolean } {
  let days = DEFAULT_DAYS;
  let dryRun = false;
  for (const arg of process.argv.slice(2)) {
    if (arg === '--dry-run') dryRun = true;
    else if (arg.startsWith('--days=')) {
      const n = parseInt(arg.slice(7), 10);
      if (!Number.isNaN(n) && n > 0) days = n;
    }
  }
  return { days, dryRun };
}

async function cleanOldCarts() {
  const { days, dryRun } = parseArgs();

  try {
    if (dryRun) {
      console.log(`[DRY RUN] Would delete guest carts not updated in the last ${days} days.`);
    } else {
      console.log(`Cleaning guest carts not updated in the last ${days} days...`);
    }

    // Count cart_ids we're about to remove (for reporting)
    const [countRows] = await db.query<{ cnt: number }[]>(
      `SELECT COUNT(*) AS cnt FROM shopping_carts
       WHERE session_id IS NOT NULL
         AND updated_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [days]
    );
    const cartCount = (countRows as { cnt: number }[])?.[0]?.cnt ?? 0;

    if (cartCount === 0) {
      console.log('No old guest carts to remove.');
      return;
    }

    // Count cart_items that will be removed (CASCADE)
    const [itemRows] = await db.query<{ cnt: number }[]>(
      `SELECT COUNT(*) AS cnt FROM cart_items ci
       INNER JOIN shopping_carts sc ON ci.cart_id = sc.id
       WHERE sc.session_id IS NOT NULL
         AND sc.updated_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [days]
    );
    const itemCount = (itemRows as { cnt: number }[])?.[0]?.cnt ?? 0;

    if (dryRun) {
      console.log(`[DRY RUN] Would delete ${cartCount} guest cart(s) and ${itemCount} cart item(s).`);
      return;
    }

    // Delete old guest carts; cart_items go away via ON DELETE CASCADE
    const [result] = await db.query<{ affectedRows: number }>(
      `DELETE FROM shopping_carts
       WHERE session_id IS NOT NULL
         AND updated_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [days]
    );
    const affected = (result as unknown as { affectedRows: number })?.affectedRows ?? 0;
    console.log(`Removed ${affected} guest cart(s) (and their items).`);
  } catch (error) {
    console.error('Error cleaning old carts:', error);
    process.exitCode = 1;
  } finally {
    try {
      await db.close();
    } catch (_) {}
    process.exit(process.exitCode ?? 0);
  }
}

cleanOldCarts();
