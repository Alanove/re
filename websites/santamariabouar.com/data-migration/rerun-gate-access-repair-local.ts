/**
 * Clear and re-run the gate-access repair locally for verification.
 * Usage: npx ts-node data-migration/rerun-gate-access-repair-local.ts
 */
import { bootstrapMigrationEnv } from './lib/bootstrapEnv';
bootstrapMigrationEnv();

import { db } from '../src/config/database';
import { runMigration } from './2026-08-14-repair-main-gate-access-from-excel';

async function main() {
  console.log('Clearing previous success mark for 2026-08-14-repair-main-gate-access-from-excel...');
  await db.query(
    `DELETE FROM migrations WHERE migration_name = '2026-08-14-repair-main-gate-access-from-excel'`
  );

  await runMigration({
    log: (message) => console.log(`   ${message}`)
  });

  await db.query(
    `INSERT INTO migrations (migration_name, status, notes)
     VALUES (?, 'success', ?)
     ON DUPLICATE KEY UPDATE status = 'success', notes = VALUES(notes), executed_at = CURRENT_TIMESTAMP`,
    [
      '2026-08-14-repair-main-gate-access-from-excel',
      `Local verification re-run at ${new Date().toISOString()}`
    ]
  );

  console.log('\nDone. Spot-check in the browser:');
  console.log('  Linda  → http://localhost:3002/admin/apartments/82/edit  (Main Gate Access)');
  console.log('  Carl   → http://localhost:3002/admin/apartments/54/edit  (Main Gate Access)');
  console.log('  Chabel → http://localhost:3002/admin/apartments/36/edit  (Main Gate Access)');
  console.log('  Report → docs/maingate/import-report-*.txt');

  await db.close();
}

main().catch(async (error) => {
  console.error(error);
  await db.close();
  process.exit(1);
});
