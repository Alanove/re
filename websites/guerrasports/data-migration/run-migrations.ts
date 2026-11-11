/**
 * Migration runner: brings the database up to date by running pending migrations.
 *
 * Environment: Uses NODE_ENV to load .env.<NODE_ENV> (e.g. online NODE_ENV=production → .env.production).
 * Child migration scripts inherit process.env, so they use the same env.
 *
 * Usage:
 *   npm run migrate                              # Dev: pending migrations (.env.development)
 *   npm run migrate:production                   # Production with ts-node (.env.production)
 *   npm run migrate:production:built             # Production after build (no ts-node needed)
 *   npm run migrate:status:production            # Show applied/pending on production DB
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
const SOURCE_MIGRATION_DIR = path.join(process.cwd(), 'data-migration');
const COMPILED_MIGRATION_DIR = path.join(process.cwd(), 'dist', 'data-migration');

/** Canonical migration key stored in _migrations (always the .ts filename). */
function migrationKey(filename: string): string {
  return filename.replace(/\.js$/i, '.ts');
}

function getMigrationDir(): string {
  if (fs.existsSync(SOURCE_MIGRATION_DIR)) {
    return SOURCE_MIGRATION_DIR;
  }
  if (fs.existsSync(COMPILED_MIGRATION_DIR)) {
    return COMPILED_MIGRATION_DIR;
  }
  return SOURCE_MIGRATION_DIR;
}

function getMigrationFiles(): string[] {
  const dir = getMigrationDir();
  const files = fs.readdirSync(dir);
  const keys = new Set<string>();

  for (const f of files) {
    if (f === 'run-migrations.ts' || f === 'run-migrations.js') continue;
    if (f.endsWith('.ts') || f.endsWith('.js')) {
      keys.add(migrationKey(f));
    }
  }

  return [...keys].sort();
}

function resolveMigrationScriptPath(filename: string): string {
  const key = migrationKey(filename);
  const compiledPath = path.join(COMPILED_MIGRATION_DIR, key.replace(/\.ts$/, '.js'));
  if (fs.existsSync(compiledPath)) {
    return compiledPath;
  }
  return path.join(SOURCE_MIGRATION_DIR, key);
}

function useCompiledRunner(scriptPath: string): boolean {
  return scriptPath.startsWith(COMPILED_MIGRATION_DIR) && scriptPath.endsWith('.js');
}

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
  return new Set((rows || []).map((r) => migrationKey(r.migration_name)));
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
if(typeof f!=='function'){console.error('Migration must export default async function:',p);process.exit(1);}
Promise.resolve(f()).then(function(){process.exit(0);}).catch(function(e){console.error(e);process.exit(1);});`;

const MIGRATION_CHILD_COMPILED_RUNNER = `var p=process.env.MIGRATION_SCRIPT_PATH;
if(!p){console.error('MIGRATION_SCRIPT_PATH is missing');process.exit(1);}
var m=require(p);
var f=m && m.default;
if(typeof f!=='function'){console.error('Migration must export default async function:',p);process.exit(1);}
Promise.resolve(f()).then(function(){process.exit(0);}).catch(function(e){console.error(e);process.exit(1);});`;

function runMigrationScript(filename: string): Promise<number> {
  return new Promise((resolve) => {
    const scriptPath = resolveMigrationScriptPath(filename);
    const compiled = useCompiledRunner(scriptPath);
    const pathHasSpaces = scriptPath.includes(' ');
    let child: ReturnType<typeof spawn>;

    if (compiled && !pathHasSpaces) {
      child = spawn(process.execPath, [scriptPath], {
        stdio: 'inherit',
        cwd: process.cwd(),
        env: process.env,
        shell: false
      });
    } else if (compiled && pathHasSpaces) {
      const env = { ...process.env, MIGRATION_SCRIPT_PATH: scriptPath };
      child = spawn(process.execPath, ['-e', MIGRATION_CHILD_COMPILED_RUNNER], {
        stdio: 'inherit',
        cwd: process.cwd(),
        env,
        shell: false
      });
    } else if (pathHasSpaces) {
      const env = { ...process.env, MIGRATION_SCRIPT_PATH: scriptPath };
      child = spawn(
        process.execPath,
        ['-r', 'ts-node/register', '-e', MIGRATION_CHILD_REQUIRE_RUNNER],
        { stdio: 'inherit', cwd: process.cwd(), env, shell: false }
      );
    } else {
      const isWindows = process.platform === 'win32';
      child = spawn(
        isWindows ? 'npx.cmd' : 'npx',
        ['ts-node', scriptPath],
        { stdio: 'inherit', cwd: process.cwd(), env: process.env, shell: false }
      );
    }

    child.on('close', (code) => resolve(code ?? 1));
    child.on('error', () => resolve(1));
  });
}

function logMigrationEnvironment(): void {
  const envExists = fs.existsSync(envPath);
  console.log(`Environment: NODE_ENV=${nodeEnv}`);
  console.log(`Env file: ${envPath}${envExists ? '' : ' (not found — using process env / .env only)'}`);
  console.log(`Database: ${process.env.DB_HOST || 'localhost'} / ${process.env.DB_NAME || '(default)'}\n`);
}

async function run(): Promise<void> {
  logMigrationEnvironment();
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
  logMigrationEnvironment();
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
    const key = migrationKey(filename);
    if (!filesSet.has(key)) {
      console.warn(`  Skipping unknown migration: ${filename}`);
      continue;
    }
    if (applied.has(key)) {
      console.log(`  Already applied: ${key}`);
      continue;
    }
    await db.query(
      `INSERT INTO ${MIGRATIONS_TABLE} (migration_name) VALUES (?)`,
      [key]
    );
    console.log(`  Marked applied: ${key}`);
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
