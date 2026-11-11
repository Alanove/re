/**
 * Migration runner: brings the database up to date by running pending migrations.
 *
 * Environment: Uses NODE_ENV to load .env.<NODE_ENV> (e.g. online NODE_ENV=production → .env.production).
 * Child migration scripts inherit process.env, so they use the same env.
 *
 * Usage:
 *   npm run migrate            # Run all pending migrations
 *   npm run migrate:status     # Show which migrations are applied or pending
 *   npm run migrate:mark-applied [--all] [file1.ts file2.ts ...]
 *                              # Record migrations as applied without running them
 *   npm run migrate:check       # Detect applied migrations from DB and mark them
 *
 * Migrations are run in filename order (e.g. 2025-01-15-* before 2026-01-*).
 * Each migration is run once; applied migrations are recorded in _migrations.
 */

import dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';

const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = `.env.${nodeEnv}`;
const envPath = path.resolve(process.cwd(), envFile);
dotenv.config({ path: envPath });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { db } from '../src/config/database';

const MIGRATIONS_TABLE = '_migrations';
const DATA_MIGRATION_DIR = path.join(__dirname);

async function ensureMigrationsTable(): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      migration_name VARCHAR(255) PRIMARY KEY,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function getAppliedMigrations(): Promise<Set<string>> {
  const [rows] = await db.query<{ migration_name: string }>(
    `SELECT migration_name FROM ${MIGRATIONS_TABLE}`
  );
  return new Set((rows || []).map((r) => r.migration_name));
}

const MIGRATION_IGNORE = new Set([
  'run-migrations.ts',
  'check-and-mark-migrations.ts',
]);

function getMigrationFiles(): string[] {
  const files = fs.readdirSync(DATA_MIGRATION_DIR);
  return files
    .filter(
      (f) =>
        f.endsWith('.ts') &&
        !MIGRATION_IGNORE.has(f) &&
        !f.startsWith('_')
    )
    .sort();
}

/**
 * When the script path contains spaces, we cannot pass it as a normal `ts-node` argv (spawn/shell edge cases),
 * so we pass it via MIGRATION_SCRIPT_PATH and `require()` the file. That means `require.main === module` is
 * false inside the migration, so the usual `if (require.main === module) run();` block never runs — the old
 * code only `require()`'d the module, exited 0, and the runner still recorded the migration as applied
 * (schema never changed). This snippet invokes the module's `default` export (async run function).
 */
const MIGRATION_CHILD_REQUIRE_RUNNER = `require('ts-node/register');
var p=process.env.MIGRATION_SCRIPT_PATH;
if(!p){console.error('MIGRATION_SCRIPT_PATH is missing');process.exit(1);}
var m=require(p);
var f=m && m.default;
if(typeof f!=='function'){console.error('Migration must export default function or class:',p);process.exit(1);}
function invokeMigrationDefault(){
  var isClass=/^class\\s/.test(Function.prototype.toString.call(f));
  if(isClass){
    var inst=new f();
    if(typeof inst.run==='function')return inst.run();
    if(typeof inst.up==='function')return inst.up();
    console.error('Migration class must define run() or up():',p);process.exit(1);
  }
  return f();
}
Promise.resolve(invokeMigrationDefault()).then(function(r){
  if (r && typeof r === 'object' && 'success' in r && (r).success === false) {
    process.exit(1);
  }
  process.exit(0);
}).catch(function(e){console.error(e);process.exit(1);});`;

function runMigrationScript(filename: string): Promise<number> {
  return new Promise((resolve) => {
    const scriptPath = path.join(DATA_MIGRATION_DIR, filename);
    // Always run via Node + ts-node/register + MIGRATION_SCRIPT_PATH: avoids Windows
    // spawn EINVAL with npx.cmd under shell:false, and avoids shell parsing when paths contain spaces.
    const env = { ...process.env, MIGRATION_SCRIPT_PATH: scriptPath };
    const child = spawn(
      process.execPath,
      ['-r', 'ts-node/register', '-e', MIGRATION_CHILD_REQUIRE_RUNNER],
      { stdio: 'inherit', cwd: process.cwd(), env, shell: false }
    );

    child.on('close', (code) => resolve(code ?? 1));
    child.on('error', () => resolve(1));
  });
}

async function run(): Promise<void> {
  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();
  const files = getMigrationFiles();
  const pending = files.filter((f) => !applied.has(f));

  if (pending.length === 0) {
    console.log('Database is up to date. No pending migrations.\n');
    process.exit(0);
    return;
  }

  console.log(`Running ${pending.length} pending migration(s)...\n`);

  for (const filename of pending) {
    process.stdout.write(`  ${filename} ... `);
    const code = await runMigrationScript(filename);
    if (code !== 0) {
      console.error(`\nMigration failed: ${filename} (exit code ${code})\n`);
      process.exit(1);
    }
    await db.query(
      `INSERT INTO ${MIGRATIONS_TABLE} (migration_name) VALUES (?)`,
      [filename]
    );
    console.log('OK');
  }

  console.log('\nAll migrations completed.\n');
  process.exit(0);
}

async function status(): Promise<void> {
  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();
  const files = getMigrationFiles();

  console.log('Migration status:\n');
  console.log('  Migration Name                          Status');
  console.log('  ' + '-'.repeat(52));

  for (const f of files) {
    const status = applied.has(f) ? 'Applied' : 'Pending';
    const name = f.padEnd(40);
    console.log(`  ${name} ${status}`);
  }

  console.log('');
  process.exit(0);
}

async function markApplied(): Promise<void> {
  const args = process.argv.slice(2).filter((a) => a !== 'mark-applied');
  const useAll = args.includes('--all');
  const filenames = useAll ? [] : args.filter((a) => !a.startsWith('--'));

  if (useAll) {
    filenames.push(...getMigrationFiles());
  }

  if (filenames.length === 0) {
    console.log(
      'Usage: ts-node run-migrations.ts mark-applied [--all] [file1.ts file2.ts ...]\n' +
        '  --all    Mark every migration file as applied.\n' +
        '  Or list specific filenames to mark as applied (e.g. 2025-01-15-ecommerce-schema.ts).'
    );
    process.exit(1);
  }

  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();
  const filesSet = new Set(getMigrationFiles());

  let marked = 0;
  for (const filename of filenames) {
    if (!filesSet.has(filename)) {
      console.warn(`  Skipping unknown migration: ${filename}`);
      continue;
    }
    if (applied.has(filename)) {
      console.log(`  Already applied: ${filename}`);
      continue;
    }
    await db.query(
      `INSERT INTO ${MIGRATIONS_TABLE} (migration_name) VALUES (?)`,
      [filename]
    );
    console.log(`  Marked applied: ${filename}`);
    marked++;
  }

  console.log(`\nMarked ${marked} migration(s) as applied.\n`);
  process.exit(0);
}

const command = process.argv[2] || 'run';
if (command === 'status') {
  status().catch((err) => {
    console.error(err);
    process.exit(1);
  });
} else if (command === 'run') {
  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
} else if (command === 'mark-applied') {
  markApplied().catch((err) => {
    console.error(err);
    process.exit(1);
  });
} else {
  console.log(
    'Usage: ts-node run-migrations.ts [run|status|mark-applied [--all] [file...]]'
  );
  process.exit(1);
}
