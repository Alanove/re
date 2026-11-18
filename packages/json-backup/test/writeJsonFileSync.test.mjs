import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let cachedModulePromise;

function compileAndImport() {
  if (!cachedModulePromise) {
    cachedModulePromise = (async () => {
      const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'json-backup-tsc-'));
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
      const tsc = spawnSync(process.execPath, [tscJs, '-p', configPath], { encoding: 'utf8' });
      assert.equal(tsc.status, 0, `${tsc.stdout}\n${tsc.stderr}`);
      return import(pathToFileURL(path.join(outDir, 'writeJsonFileSync.js')).href);
    })();
  }
  return cachedModulePromise;
}

function sundayInNovember2026() {
  return new Date(2026, 10, 15, 12, 0, 0);
}

function firstOfOctober2026() {
  return new Date(2026, 9, 1, 12, 0, 0);
}

test('writes a new file without creating backups', async () => {
  const mod = await compileAndImport();
  const site = fs.mkdtempSync(path.join(os.tmpdir(), 'json-backup-site-'));
  const file = path.join(site, 'data', 'pages.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  mod.writeJsonFileSync(file, JSON.stringify({ ok: 1 }, null, 2));
  assert.equal(fs.existsSync(path.join(site, 'data-backups')), false);
  assert.match(fs.readFileSync(file, 'utf8'), /"ok": 1/);
});

test('skips write and backup when content is unchanged', async () => {
  const mod = await compileAndImport();
  const site = fs.mkdtempSync(path.join(os.tmpdir(), 'json-backup-site-'));
  const file = path.join(site, 'data', 'pages.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const text = `${JSON.stringify({ ok: 1 }, null, 2)}\n`;
  fs.writeFileSync(file, text);
  mod.writeJsonFileSync(file, text, { now: sundayInNovember2026() });
  assert.equal(fs.existsSync(path.join(site, 'data-backups')), false);
});

test('snapshots daily and weekly on Sunday before replacing', async () => {
  const mod = await compileAndImport();
  const site = fs.mkdtempSync(path.join(os.tmpdir(), 'json-backup-site-'));
  const file = path.join(site, 'data', 'pages.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify({ v: 1 }, null, 2)}\n`);
  mod.writeJsonFileSync(file, JSON.stringify({ v: 2 }, null, 2), { now: sundayInNovember2026() });
  const daily = path.join(site, 'data-backups', 'pages.json', 'daily', '2026-11-15.json');
  const weekly = path.join(
    site,
    'data-backups',
    'pages.json',
    'weekly',
    `${mod.isoWeekKey(sundayInNovember2026())}.json`
  );
  assert.equal(JSON.parse(fs.readFileSync(daily, 'utf8')).v, 1);
  assert.equal(JSON.parse(fs.readFileSync(weekly, 'utf8')).v, 1);
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).v, 2);
  assert.equal(fs.existsSync(path.join(site, 'data-backups', 'pages.json', 'monthly')), false);
});

test('keeps the first snapshot of the day when saving again', async () => {
  const mod = await compileAndImport();
  const site = fs.mkdtempSync(path.join(os.tmpdir(), 'json-backup-site-'));
  const file = path.join(site, 'data', 'pages.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify({ v: 1 }, null, 2)}\n`);
  const now = sundayInNovember2026();
  mod.writeJsonFileSync(file, JSON.stringify({ v: 2 }, null, 2), { now });
  mod.writeJsonFileSync(file, JSON.stringify({ v: 3 }, null, 2), { now });
  const daily = path.join(site, 'data-backups', 'pages.json', 'daily', '2026-11-15.json');
  assert.equal(JSON.parse(fs.readFileSync(daily, 'utf8')).v, 1);
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).v, 3);
});

test('writes monthly and quarterly on the first of a quarter', async () => {
  const mod = await compileAndImport();
  const site = fs.mkdtempSync(path.join(os.tmpdir(), 'json-backup-site-'));
  const file = path.join(site, 'data', 'pages.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify({ v: 1 }, null, 2)}\n`);
  mod.writeJsonFileSync(file, JSON.stringify({ v: 2 }, null, 2), { now: firstOfOctober2026() });
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(site, 'data-backups', 'pages.json', 'monthly', '2026-10.json'), 'utf8')).v,
    1
  );
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(site, 'data-backups', 'pages.json', 'quarterly', '2026-Q4.json'), 'utf8')).v,
    1
  );
  assert.equal(fs.existsSync(path.join(site, 'data-backups', 'pages.json', 'weekly')), false);
});

test('prunes daily snapshots beyond seven', async () => {
  const mod = await compileAndImport();
  const site = fs.mkdtempSync(path.join(os.tmpdir(), 'json-backup-site-'));
  const file = path.join(site, 'data', 'pages.json');
  const dailyDir = path.join(site, 'data-backups', 'pages.json', 'daily');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.mkdirSync(dailyDir, { recursive: true });
  for (let day = 1; day <= 7; day += 1) {
    fs.writeFileSync(path.join(dailyDir, `2026-11-${String(day).padStart(2, '0')}.json`), '{"old":true}\n');
  }
  fs.writeFileSync(file, `${JSON.stringify({ v: 1 }, null, 2)}\n`);
  mod.writeJsonFileSync(file, JSON.stringify({ v: 2 }, null, 2), { now: new Date(2026, 10, 20, 12, 0, 0) });
  const remaining = fs.readdirSync(dailyDir).sort();
  assert.equal(remaining.length, 7);
  assert.ok(remaining.includes('2026-11-20.json'));
  assert.equal(remaining.includes('2026-11-01.json'), false);
});
