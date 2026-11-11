/**
 * Apply account home / payments settings migration.
 * Run: npx ts-node data-migration/apply-account-home-payments.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { db } from '../src/config/database';

const FILE = '2026-07-27-account-home-payments.sql';

async function run() {
  await db.testConnection();

  const migrationName = FILE.replace('.sql', '');
  const [existing] = (await db.query(
    'SELECT id, status FROM migrations WHERE migration_name = ?',
    [migrationName]
  )) as [any[], any];

  if (existing.length && existing[0].status === 'success') {
    console.log(`Skipping ${FILE} (already applied)`);
    process.exit(0);
  }

  console.log(`Applying ${FILE}...`);
  const sql = fs.readFileSync(path.join(__dirname, FILE), 'utf8');
  const cleaned = sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');
  const statements = cleaned
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    await db.query(statement);
  }

  if (existing.length) {
    await db.query(
      `UPDATE migrations SET status = 'success', error_message = NULL, executed_at = NOW() WHERE migration_name = ?`,
      [migrationName]
    );
  } else {
    await db.query(
      `INSERT INTO migrations (migration_name, status) VALUES (?, 'success')`,
      [migrationName]
    );
  }

  console.log(`Applied ${FILE} successfully`);
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
