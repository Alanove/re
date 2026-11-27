import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let cachedModulePromise;

function compileAndImport() {
  if (!cachedModulePromise) {
    cachedModulePromise = (async () => {
      const outDir = path.join(root, 'test', '.compiled');
      fs.rmSync(outDir, { recursive: true, force: true });
      fs.mkdirSync(outDir, { recursive: true });
      const configPath = path.join(outDir, 'tsconfig.json');
      fs.writeFileSync(
        configPath,
        JSON.stringify(
          {
            compilerOptions: {
              target: 'ES2022',
              module: 'NodeNext',
              moduleResolution: 'NodeNext',
              strict: true,
              skipLibCheck: true,
              rootDir: path.join(root, 'src').replace(/\\/g, '/'),
              outDir: outDir.replace(/\\/g, '/'),
              declaration: false,
              esModuleInterop: true,
              typeRoots: [path.join(root, 'node_modules', '@types').replace(/\\/g, '/')],
              types: ['node']
            },
            include: [path.join(root, 'src', '**', '*.ts').replace(/\\/g, '/')]
          },
          null,
          2
        )
      );
      const tscJs = path.join(root, 'node_modules', 'typescript', 'lib', 'tsc.js');
      const result = spawnSync(process.execPath, [tscJs, '-p', configPath], {
        encoding: 'utf8',
        cwd: root
      });
      if (result.status !== 0) {
        throw new Error(`tsc failed:\n${result.stdout}\n${result.stderr}`);
      }
      return import(pathToFileURL(path.join(outDir, 'createPostgres.js')).href);
    })();
  }
  return cachedModulePromise;
}

test('query refuses when postgres is not configured', async () => {
  const { createPostgres, PostgresError } = await compileAndImport();
  const db = createPostgres(null);
  assert.equal(db.isConfigured(), false);
  await assert.rejects(
    () => db.query('SELECT 1'),
    (error) => error instanceof PostgresError && error.message === 'Postgres is not configured.'
  );
});

test('rejects a half-filled host config', async () => {
  const { createPostgres, PostgresError } = await compileAndImport();
  assert.throws(
    () =>
      createPostgres({
        host: 'localhost',
        user: 'app'
      }),
    (error) => error instanceof PostgresError && /half|partial|Invalid postgres/i.test(error.message)
  );
});

test('rejects mixing connectionString with host parts', async () => {
  const { createPostgres, PostgresError } = await compileAndImport();
  assert.throws(
    () =>
      createPostgres({
        connectionString: 'postgres://localhost/db',
        host: 'localhost',
        user: 'app',
        password: 'secret',
        database: 'db'
      }),
    (error) => error instanceof PostgresError
  );
});

test('query sends SQL and params to the pool', async () => {
  const { createPostgres } = await compileAndImport();
  const calls = [];
  const db = createPostgres(
    {
      connectionString: 'postgres://localhost/db',
      max: 3
    },
    {
      poolFactory: () => ({
        async query(sql, params) {
          calls.push({ sql, params });
          return { rows: [{ ok: 1 }], rowCount: 1 };
        },
        async end() {}
      })
    }
  );

  assert.equal(db.isConfigured(), true);
  const result = await db.query('SELECT id FROM users WHERE email = $1', ['a@example.com']);
  assert.deepEqual(result.rows, [{ ok: 1 }]);
  assert.equal(result.rowCount, 1);
  assert.deepEqual(calls, [{ sql: 'SELECT id FROM users WHERE email = $1', params: ['a@example.com'] }]);
});

test('check runs SELECT 1', async () => {
  const { createPostgres } = await compileAndImport();
  const calls = [];
  const db = createPostgres(
    {
      host: 'localhost',
      port: 5432,
      user: 'app',
      password: 'secret',
      database: 'finance'
    },
    {
      poolFactory: () => ({
        async query(sql, params) {
          calls.push({ sql, params });
          return { rows: [{ '?column?': 1 }], rowCount: 1 };
        },
        async end() {}
      })
    }
  );

  await db.check();
  assert.equal(calls[0].sql, 'SELECT 1');
});

test('close ends the pool once', async () => {
  const { createPostgres } = await compileAndImport();
  let ended = 0;
  const db = createPostgres(
    { connectionString: 'postgres://localhost/db' },
    {
      poolFactory: () => ({
        async query() {
          return { rows: [], rowCount: 0 };
        },
        async end() {
          ended += 1;
        }
      })
    }
  );
  await db.query('SELECT 1');
  await db.close();
  await db.close();
  assert.equal(ended, 1);
});

test('empty SQL is rejected', async () => {
  const { createPostgres, PostgresError } = await compileAndImport();
  const db = createPostgres(
    { connectionString: 'postgres://localhost/db' },
    {
      poolFactory: () => ({
        async query() {
          return { rows: [], rowCount: 0 };
        },
        async end() {}
      })
    }
  );
  await assert.rejects(
    () => db.query('   '),
    (error) => error instanceof PostgresError && error.message === 'SQL must not be empty.'
  );
});
