"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const child_process_1 = require("child_process");
const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = `.env.${nodeEnv}`;
const envPath = path.resolve(process.cwd(), envFile);
dotenv_1.default.config({ path: envPath });
dotenv_1.default.config({ path: path.resolve(process.cwd(), '.env') });
const database_1 = require("../src/config/database");
const MIGRATIONS_TABLE = '_migrations';
const SOURCE_MIGRATION_DIR = path.join(process.cwd(), 'data-migration');
const COMPILED_MIGRATION_DIR = path.join(process.cwd(), 'dist', 'data-migration');
function migrationKey(filename) {
    return filename.replace(/\.js$/i, '.ts');
}
function getMigrationDir() {
    if (fs.existsSync(SOURCE_MIGRATION_DIR)) {
        return SOURCE_MIGRATION_DIR;
    }
    if (fs.existsSync(COMPILED_MIGRATION_DIR)) {
        return COMPILED_MIGRATION_DIR;
    }
    return SOURCE_MIGRATION_DIR;
}
function getMigrationFiles() {
    const dir = getMigrationDir();
    const files = fs.readdirSync(dir);
    const keys = new Set();
    for (const f of files) {
        if (f === 'run-migrations.ts' || f === 'run-migrations.js')
            continue;
        if (f.endsWith('.ts') || f.endsWith('.js')) {
            keys.add(migrationKey(f));
        }
    }
    return [...keys].sort();
}
function resolveMigrationScriptPath(filename) {
    const key = migrationKey(filename);
    const compiledPath = path.join(COMPILED_MIGRATION_DIR, key.replace(/\.ts$/, '.js'));
    if (fs.existsSync(compiledPath)) {
        return compiledPath;
    }
    return path.join(SOURCE_MIGRATION_DIR, key);
}
function useCompiledRunner(scriptPath) {
    return scriptPath.startsWith(COMPILED_MIGRATION_DIR) && scriptPath.endsWith('.js');
}
async function ensureMigrationsTable() {
    await database_1.db.query(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      migration_name VARCHAR(255) PRIMARY KEY,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}
async function getAppliedMigrations() {
    const [rows] = await database_1.db.query(`SELECT migration_name FROM ${MIGRATIONS_TABLE}`);
    return new Set((rows || []).map((r) => migrationKey(r.migration_name)));
}
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
function runMigrationScript(filename) {
    return new Promise((resolve) => {
        const scriptPath = resolveMigrationScriptPath(filename);
        const compiled = useCompiledRunner(scriptPath);
        const pathHasSpaces = scriptPath.includes(' ');
        let child;
        if (compiled && !pathHasSpaces) {
            child = (0, child_process_1.spawn)(process.execPath, [scriptPath], {
                stdio: 'inherit',
                cwd: process.cwd(),
                env: process.env,
                shell: false
            });
        }
        else if (compiled && pathHasSpaces) {
            const env = { ...process.env, MIGRATION_SCRIPT_PATH: scriptPath };
            child = (0, child_process_1.spawn)(process.execPath, ['-e', MIGRATION_CHILD_COMPILED_RUNNER], {
                stdio: 'inherit',
                cwd: process.cwd(),
                env,
                shell: false
            });
        }
        else if (pathHasSpaces) {
            const env = { ...process.env, MIGRATION_SCRIPT_PATH: scriptPath };
            child = (0, child_process_1.spawn)(process.execPath, ['-r', 'ts-node/register', '-e', MIGRATION_CHILD_REQUIRE_RUNNER], { stdio: 'inherit', cwd: process.cwd(), env, shell: false });
        }
        else {
            const tsNodeBin = path.join(process.cwd(), 'node_modules', 'ts-node', 'dist', 'bin.js');
            child = (0, child_process_1.spawn)(process.execPath, [tsNodeBin, scriptPath], {
                stdio: 'inherit',
                cwd: process.cwd(),
                env: process.env,
                shell: false
            });
        }
        child.on('close', (code) => resolve(code ?? 1));
        child.on('error', () => resolve(1));
    });
}
function logMigrationEnvironment() {
    const envExists = fs.existsSync(envPath);
    console.log(`Environment: NODE_ENV=${nodeEnv}`);
    console.log(`Env file: ${envPath}${envExists ? '' : ' (not found — using process env / .env only)'}`);
    console.log(`Database: ${process.env.DB_HOST || 'localhost'} / ${process.env.DB_NAME || '(default)'}\n`);
}
async function run() {
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
        await database_1.db.query(`INSERT INTO ${MIGRATIONS_TABLE} (migration_name) VALUES (?)`, [filename]);
        console.log('OK');
    }
    console.log('\nAll migrations completed.\n');
    process.exit(0);
}
async function status() {
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
async function markApplied() {
    const args = process.argv.slice(2).filter((a) => a !== 'mark-applied');
    const useAll = args.includes('--all');
    const filenames = useAll ? [] : args.filter((a) => !a.startsWith('--'));
    if (useAll) {
        filenames.push(...getMigrationFiles());
    }
    if (filenames.length === 0) {
        console.log('Usage: ts-node run-migrations.ts mark-applied [--all] [file1.ts file2.ts ...]\n' +
            '  --all    Mark every migration file as applied.\n' +
            '  Or list specific filenames to mark as applied (e.g. 2025-01-15-ecommerce-schema.ts).');
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
        await database_1.db.query(`INSERT INTO ${MIGRATIONS_TABLE} (migration_name) VALUES (?)`, [key]);
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
}
else if (command === 'run') {
    run().catch((err) => {
        console.error(err);
        process.exit(1);
    });
}
else if (command === 'mark-applied') {
    markApplied().catch((err) => {
        console.error(err);
        process.exit(1);
    });
}
else {
    console.log('Usage: ts-node run-migrations.ts [run|status|mark-applied [--all] [file...]]');
    process.exit(1);
}
//# sourceMappingURL=run-migrations.js.map