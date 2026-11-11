/**
 * Replace "Janitor" title with "Coordinator" in stored data.
 * - Renames the financial account named "Janitor" → "Coordinator"
 * - Updates About (and any) page content that mentions on-site janitor
 *
 * Rollback:
 * UPDATE accounts SET name = 'Janitor' WHERE name = 'Coordinator';
 * UPDATE pages SET content = REPLACE(content, 'On-site coordinator', 'On-site janitor')
 *   WHERE content LIKE '%On-site coordinator%';
 */

import { db } from '../src/config/database';
import { MigrationContext } from './lib/migrationTypes';

export async function runMigration(ctx: MigrationContext): Promise<void> {
  const [accountResult] = await db.query(
    `UPDATE accounts SET name = 'Coordinator' WHERE name = 'Janitor'`
  );
  const accountsUpdated = (accountResult as any).affectedRows ?? 0;
  ctx.log(
    accountsUpdated > 0
      ? `Renamed ${accountsUpdated} account(s) from Janitor to Coordinator.`
      : 'No account named Janitor found (already renamed or absent).'
  );

  const [pageResult] = await db.query(
    `UPDATE pages
     SET content = REPLACE(content, 'On-site janitor', 'On-site coordinator')
     WHERE content LIKE '%On-site janitor%'`
  );
  const pagesUpdated = (pageResult as any).affectedRows ?? 0;
  ctx.log(
    pagesUpdated > 0
      ? `Updated janitor wording in ${pagesUpdated} page(s).`
      : 'No page content containing "On-site janitor" found.'
  );
}
