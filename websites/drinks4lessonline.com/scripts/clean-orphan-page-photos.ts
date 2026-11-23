/**
 * Find and optionally remove page_photos rows whose page_id no longer exists in pages.
 * Use when pages were deleted outside the app (e.g. direct SQL) so photo rows were left behind.
 *
 * Usage:
 *   npx ts-node scripts/clean-orphan-page-photos.ts           # list orphaned rows only (uses .env.development)
 *   npx ts-node scripts/clean-orphan-page-photos.ts --fix     # delete orphaned rows
 *   NODE_ENV=production npx ts-node scripts/clean-orphan-page-photos.ts --fix   # production DB (.env.production)
 *   npm run clean:page-photos:fix:prod                        # same, from package.json
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

function parseArgs(): { fix: boolean; dryRun: boolean } {
  let fix = false;
  let dryRun = false;
  for (const arg of process.argv.slice(2)) {
    if (arg === '--fix') fix = true;
    else if (arg === '--dry-run') dryRun = true;
  }
  return { fix, dryRun };
}

interface OrphanRow {
  id: number;
  page_id: number;
  filename: string;
  file_path: string;
  display_order: number;
}

async function main() {
  const { fix, dryRun } = parseArgs();

  try {
    // Find page_photos whose page_id is not in pages
    const [rows] = await db.query(
      `SELECT pp.id, pp.page_id, pp.filename, pp.file_path, pp.display_order
       FROM page_photos pp
       LEFT JOIN pages p ON p.id = pp.page_id
       WHERE p.id IS NULL`
    );

    const orphans: OrphanRow[] = Array.isArray(rows) ? (rows as OrphanRow[]) : [];

    if (orphans.length === 0) {
      console.log('No orphaned page_photos found (all page_id values exist in pages).');
      return;
    }

    console.log(`Found ${orphans.length} orphaned page_photo(s) (page_id not in pages).`);
    const showCount = Math.min(orphans.length, 15);
    for (let i = 0; i < showCount; i++) {
      const r = orphans[i];
      console.log(`  id=${r.id} page_id=${r.page_id} filename=${r.filename} file_path=${r.file_path}`);
    }
    if (orphans.length > showCount) {
      console.log(`  ... and ${orphans.length - showCount} more.`);
    }

    if (fix && !dryRun) {
      const ids = orphans.map((r) => r.id);
      const placeholders = ids.map(() => '?').join(',');
      await db.query(`DELETE FROM page_photos WHERE id IN (${placeholders})`, ids);
      console.log(`Deleted ${ids.length} orphaned row(s).`);
    } else if (fix && dryRun) {
      console.log('[DRY RUN] Would delete these rows. Run without --dry-run to apply.');
    } else {
      console.log('Run with --fix to delete these rows, or --fix --dry-run to preview.');
    }
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  } finally {
    await db.close();
  }
}

main();
