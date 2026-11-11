/**
 * Apply only the member portal migrations (skips older pending ones).
 * Run: npx ts-node data-migration/apply-member-portal-migrations.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { db } from '../src/config/database';

const FILES = [
  '2026-07-26-member-portal-schema.sql',
  '2026-07-26-member-portal-admin-menu.sql'
];

async function run() {
  await db.testConnection();

  for (const file of FILES) {
    const migrationName = file.replace('.sql', '');
    const [existing] = await db.query(
      'SELECT id, status FROM migrations WHERE migration_name = ?',
      [migrationName]
    ) as [any[], any];

    if (existing.length && existing[0].status === 'success') {
      console.log(`Skipping ${file} (already applied)`);
      continue;
    }

    console.log(`Applying ${file}...`);
    const sql = fs.readFileSync(path.join(__dirname, file), 'utf8');
    // Remove rollback comment blocks and split on semicolons
    const cleaned = sql
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n');
    const statements = cleaned
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const statement of statements) {
      console.log(`  > ${statement.substring(0, 80).replace(/\s+/g, ' ')}...`);
      await db.query(statement);
    }

    if (existing.length) {
      await db.query(
        'UPDATE migrations SET status = ?, notes = ? WHERE migration_name = ?',
        ['success', `Applied at ${new Date().toISOString()}`, migrationName]
      );
    } else {
      await db.query(
        'INSERT INTO migrations (migration_name, status, notes) VALUES (?, ?, ?)',
        [migrationName, 'success', `Applied at ${new Date().toISOString()}`]
      );
    }
    console.log(`OK ${file}`);
  }

  console.log('Done.');
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
