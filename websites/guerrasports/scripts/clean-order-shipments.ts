/**
 * Standalone script to clean old order_shipments (packages) rows.
 * The app runs this in its daily CleanupService (orders older than 2 years).
 * Use this for manual or cron runs.
 *
 * Usage:
 *   npx ts-node scripts/clean-order-shipments.ts           # delete shipments for orders older than 2 years
 *   npx ts-node scripts/clean-order-shipments.ts --years=3  # use 3 years
 *   npx ts-node scripts/clean-order-shipments.ts --dry-run # show count only, no delete
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

const nodeEnv = process.env.NODE_ENV || 'development';
const envPath = path.resolve(__dirname, '..', `.env.${nodeEnv}`);
dotenv.config({ path: envPath });

if (!process.env.DB_HOST) {
  dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
}

import db from '../src/config/database';

const DEFAULT_YEARS = 2;

function parseArgs(): { years: number; dryRun: boolean } {
  let years = DEFAULT_YEARS;
  let dryRun = false;
  for (const arg of process.argv.slice(2)) {
    if (arg === '--dry-run') dryRun = true;
    else if (arg.startsWith('--years=')) {
      const n = parseInt(arg.slice(8), 10);
      if (!Number.isNaN(n) && n > 0) years = n;
    }
  }
  return { years, dryRun };
}

async function main() {
  const { years, dryRun } = parseArgs();

  try {
    const [countRows] = await db.query(
      `SELECT COUNT(*) AS cnt
       FROM order_shipments os
       INNER JOIN orders o ON o.id = os.order_id
       WHERE o.created_at < DATE_SUB(NOW(), INTERVAL ? YEAR)`,
      [years]
    );
    const count = Number((countRows as any)?.[0]?.cnt ?? 0);

    if (count === 0) {
      console.log(`No order_shipments (packages) found for orders older than ${years} year(s).`);
      return;
    }

    if (dryRun) {
      console.log(`[DRY RUN] Would delete ${count} order_shipments row(s) for orders older than ${years} year(s).`);
      return;
    }

    const [result] = await db.query<any>(
      `DELETE os FROM order_shipments os
       INNER JOIN orders o ON o.id = os.order_id
       WHERE o.created_at < DATE_SUB(NOW(), INTERVAL ? YEAR)`,
      [years]
    );
    const deleted = (result as any).affectedRows ?? 0;
    console.log(`✓ Deleted ${deleted} order_shipments (packages) row(s).`);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  } finally {
    await db.close();
  }
}

main();
