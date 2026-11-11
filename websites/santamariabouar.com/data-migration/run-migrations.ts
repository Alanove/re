/**
 * Migration runner — applies pending SQL/TS migrations and tracks them in the database.
 *
 * Usage:
 *   npm run migrate              # development (.env.development)
 *   npm run migrate:production   # production (.env.production)
 *   npm run migrate:status       # show applied / pending migrations
 */

import { bootstrapMigrationEnv } from './lib/bootstrapEnv';
import { MigrationContext } from './lib/migrationTypes';

const nodeEnv = bootstrapMigrationEnv();

import { db } from '../src/config/database';
import * as fs from 'fs';
import * as path from 'path';

const MIGRATION_FILE_PATTERN = /^\d{4}-\d{2}-\d{2}-.+\.(sql|ts)$/;

const EXCLUDED_FILES = new Set([
  '2025-01-15-create-migrations-table.sql',
  'run-migrations.ts'
]);

/** One-off data fix / import scripts — run manually, not via npm run migrate */
const EXCLUDED_TS_SCRIPTS = new Set([
  '2025-01-15-refactor-apartment-user-relationship.ts',
  '2025-01-15-remove-redundant-apartment-columns.ts',
  '2025-01-17-check-credit-invoices.ts',
  '2025-01-17-fix-credits-as-invoices.ts',
  '2025-01-17-fix-invoice-amounts.ts',
  '2025-01-17-link-transactions-to-invoices.ts',
  '2025-01-17-refactor-payments-system.ts',
  '2025-01-17-remove-duplicate-credits.ts',
  '2025-01-17-remove-duplicate-invoice-transactions.ts',
  '2025-01-17-simple-remove-duplicates.ts',
  '2025-01-17-smart-link-transactions.ts',
  '2026-03-05-import-old-electricity-bills.ts',
  '2026-08-02-import-main-gate-access-from-excel.ts',
  '2026-08-10-enable-wallet-for-existing-balances.ts',
  '2026-08-10-repair-a7-wallet-invoice-payment.ts'
]);

interface MigrationFile {
  filename: string;
  name: string;
  type: 'sql' | 'ts';
}

class MigrationRunner {
  private migrationsDir: string;

  constructor() {
    this.migrationsDir = __dirname;
  }

  private getMigrationFiles(): MigrationFile[] {
    const files = fs
      .readdirSync(this.migrationsDir)
      .filter((file) => MIGRATION_FILE_PATTERN.test(file))
      .filter((file) => !EXCLUDED_FILES.has(file))
      .filter((file) => !EXCLUDED_TS_SCRIPTS.has(file))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    return files.map((filename) => ({
      filename,
      name: filename.replace(/\.(sql|ts)$/, ''),
      type: filename.endsWith('.sql') ? 'sql' : 'ts'
    }));
  }

  private filterMigrationFiles(
    files: MigrationFile[],
    options: { only?: string; from?: string }
  ): MigrationFile[] {
    let filtered = files;

    if (options.from) {
      filtered = filtered.filter((file) => file.name >= options.from!);
    }

    if (options.only) {
      const target = options.only.replace(/\.(sql|ts)$/, '');
      filtered = filtered.filter((file) => file.name === target);
    }

    return filtered;
  }

  private async ensureMigrationsTable(): Promise<void> {
    await db.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        migration_name VARCHAR(255) NOT NULL UNIQUE,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        executed_by VARCHAR(100) DEFAULT 'system',
        status ENUM('success', 'failed', 'rolled_back') DEFAULT 'success',
        notes TEXT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_migration_name (migration_name),
        INDEX idx_executed_at (executed_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  private async getExecutedMigrationNames(): Promise<Set<string>> {
    const [rows] = await db.query(
      `SELECT migration_name FROM migrations WHERE status = 'success'`
    );
    return new Set((rows as any[]).map((row) => row.migration_name as string));
  }

  private splitSqlStatements(sql: string): string[] {
    return sql
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n')
      .split(';')
      .map((statement) => statement.trim())
      .filter((statement) => statement.length > 0);
  }

  private async recordMigration(
    migrationName: string,
    status: 'success' | 'failed',
    notes: string
  ): Promise<void> {
    await db.query(
      `INSERT INTO migrations (migration_name, status, notes)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         status = VALUES(status),
         notes = VALUES(notes),
         executed_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP`,
      [migrationName, status, notes]
    );
  }

  private async executeSqlMigration(filename: string, migrationName: string): Promise<void> {
    const filePath = path.join(this.migrationsDir, filename);
    const sql = fs.readFileSync(filePath, 'utf8');
    const statements = this.splitSqlStatements(sql);

    for (const statement of statements) {
      const preview = statement.replace(/\s+/g, ' ').substring(0, 80);
      console.log(`   > ${preview}${statement.length > 80 ? '...' : ''}`);
      await db.query(statement);
    }

    await this.recordMigration(
      migrationName,
      'success',
      `Applied successfully at ${new Date().toISOString()}`
    );
  }

  private async executeTsMigration(filename: string, migrationName: string): Promise<void> {
    const filePath = path.join(this.migrationsDir, filename);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require(filePath) as { runMigration?: (ctx: MigrationContext) => Promise<void> };

    if (typeof mod.runMigration !== 'function') {
      throw new Error(
        `${filename} must export async function runMigration(ctx) to be run by npm run migrate`
      );
    }

    const ctx: MigrationContext = {
      log: (message: string) => console.log(`   ${message}`)
    };

    await mod.runMigration(ctx);

    await this.recordMigration(
      migrationName,
      'success',
      `Applied successfully at ${new Date().toISOString()}`
    );
  }

  private async executeMigration(file: MigrationFile): Promise<void> {
    console.log(`\n🔄 Running migration: ${file.name} (${file.type})`);

    try {
      if (file.type === 'sql') {
        await this.executeSqlMigration(file.filename, file.name);
      } else {
        await this.executeTsMigration(file.filename, file.name);
      }
      console.log(`✅ Migration ${file.name} completed successfully`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.recordMigration(
        file.name,
        'failed',
        `Failed at ${new Date().toISOString()}: ${message}`
      );
      throw error;
    }
  }

  public async markMigration(migrationName: string, notes?: string): Promise<void> {
    await this.ensureMigrationsTable();
    await this.recordMigration(
      migrationName.replace(/\.(sql|ts)$/, ''),
      'success',
      notes || `Marked as applied at ${new Date().toISOString()} without running`
    );
    console.log(`✅ Marked ${migrationName} as applied`);
  }

  public async markBefore(datePrefix: string): Promise<void> {
    await this.ensureMigrationsTable();
    const executed = await this.getExecutedMigrationNames();
    const toMark = this.getMigrationFiles().filter(
      (file) => file.name < datePrefix && !executed.has(file.name)
    );

    if (toMark.length === 0) {
      console.log(`No pending migrations before ${datePrefix} to mark.`);
      return;
    }

    console.log(`Marking ${toMark.length} migration(s) as applied (before ${datePrefix}):`);
    for (const file of toMark) {
      await this.markMigration(file.name, `Bulk marked before ${datePrefix}`);
      console.log(`   - ${file.filename}`);
    }
  }

  public async runMigrations(options: { only?: string; from?: string } = {}): Promise<void> {
    console.log(`🚀 Starting migration process (${nodeEnv})...\n`);

    const connected = await db.testConnection();
    if (!connected) {
      process.exit(1);
    }

    console.log(`📦 Database: ${process.env.DB_NAME || '(default)'}`);

    await this.ensureMigrationsTable();

    const allMigrations = this.filterMigrationFiles(this.getMigrationFiles(), options);
    const executed = await this.getExecutedMigrationNames();
    const pending = allMigrations.filter((file) => !executed.has(file.name));

    console.log(`📁 Found ${allMigrations.length} migration file(s) in scope`);
    console.log(`✅ Already applied: ${executed.size}`);

    if (executed.size > 0) {
      const [lastRows] = await db.query(
        `SELECT migration_name, executed_at
         FROM migrations
         WHERE status = 'success'
         ORDER BY executed_at DESC
         LIMIT 1`
      );
      const last = (lastRows as any[])[0];
      if (last) {
        console.log(`🕒 Last applied: ${last.migration_name} (${last.executed_at})`);
      }
    }

    if (pending.length === 0) {
      console.log('\n🎉 No pending migrations. Database is up to date!');
      return;
    }

    console.log(`\n📋 Pending migrations (${pending.length}):`);
    pending.forEach((file) => console.log(`   - ${file.filename}`));

    let successCount = 0;

    for (const file of pending) {
      try {
        await this.executeMigration(file);
        successCount++;
      } catch (error) {
        console.error(`❌ Migration ${file.name} failed:`, error);
        console.log('\n⚠️  Stopping migration process due to failure');
        process.exit(1);
      }
    }

    console.log(`\n📊 Migration summary: ${successCount} applied`);
    console.log('🎉 All pending migrations completed successfully!');
  }

  public async showStatus(): Promise<void> {
    console.log(`📊 Migration status (${nodeEnv})\n`);

    const connected = await db.testConnection();
    if (!connected) {
      process.exit(1);
    }

    console.log(`📦 Database: ${process.env.DB_NAME || '(default)'}\n`);

    await this.ensureMigrationsTable();

    const allMigrations = this.getMigrationFiles();
    const executed = await this.getExecutedMigrationNames();

    const [rows] = await db.query(
      `SELECT migration_name, executed_at, status, notes
       FROM migrations
       ORDER BY executed_at DESC`
    );
    const records = new Map(
      (rows as any[]).map((row) => [row.migration_name as string, row])
    );

    console.log('Applied migrations:');
    console.log('='.repeat(80));

    if (executed.size === 0) {
      console.log('  (none yet)');
    } else {
      allMigrations
        .filter((file) => executed.has(file.name))
        .forEach((file) => {
          const record = records.get(file.name);
          console.log(`✅ ${file.filename}`);
          if (record) {
            console.log(`   Executed: ${record.executed_at}`);
            console.log(`   Status: ${record.status}`);
          }
          console.log('');
        });
    }

    const pending = allMigrations.filter((file) => !executed.has(file.name));

    console.log('Pending migrations:');
    console.log('='.repeat(80));

    if (pending.length === 0) {
      console.log('  (none — database is up to date)');
    } else {
      pending.forEach((file) => console.log(`⏳ ${file.filename}`));
    }

    if (EXCLUDED_TS_SCRIPTS.size > 0) {
      console.log('\nManual-only scripts (not run by npm run migrate):');
      console.log('='.repeat(80));
      [...EXCLUDED_TS_SCRIPTS].sort().forEach((file) => console.log(`   • ${file}`));
    }
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter((arg) => !arg.startsWith('--env='));
  const command = args[0] || 'run';
  const runner = new MigrationRunner();
  const runOptions: { only?: string; from?: string } = {};
  const only = args.find((arg) => arg.startsWith('--only='))?.split('=')[1];
  const from = args.find((arg) => arg.startsWith('--from='))?.split('=')[1];
  if (only) runOptions.only = only;
  if (from) runOptions.from = from;

  try {
    switch (command) {
      case 'status':
        await runner.showStatus();
        break;
      case 'mark': {
        const name = args[1];
        if (!name) {
          console.error('Usage: npm run migrate:mark -- <migration-name>');
          process.exit(1);
        }
        await runner.markMigration(name);
        break;
      }
      case 'mark-before': {
        const datePrefix = args[1];
        if (!datePrefix) {
          console.error('Usage: npm run migrate:mark-before -- YYYY-MM-DD');
          process.exit(1);
        }
        await runner.markBefore(datePrefix);
        break;
      }
      case 'run':
      default:
        await runner.runMigrations(runOptions);
        break;
    }
  } finally {
    await db.close();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('💥 Migration process failed:', error);
    process.exit(1);
  });
}

export { MigrationRunner };
