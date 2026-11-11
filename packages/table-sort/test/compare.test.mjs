import assert from 'node:assert/strict';
import test from 'node:test';
import * as esbuild from 'esbuild';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function loadCompare() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'table-sort-test-'));
  const outfile = path.join(dir, 'compare.mjs');
  await esbuild.build({
    entryPoints: [path.join(__dirname, '../src/compare.ts')],
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile,
    logLevel: 'silent'
  });
  return import(pathToFileURL(outfile).href);
}

const { detectType, parseDate, parseNumber, sortIndexes, nextDirection, isEmptyValue } = await loadCompare();

const pick = (values, direction, type) => sortIndexes(values, direction, type).map((index) => values[index]);

test('parseNumber accepts plain, grouped, currency and percent values', () => {
  assert.equal(parseNumber('42'), 42);
  assert.equal(parseNumber('-3.5'), -3.5);
  assert.equal(parseNumber('1,234,000'), 1234000);
  assert.equal(parseNumber('$12.50'), 12.5);
  assert.equal(parseNumber('75%'), 75);
  assert.equal(parseNumber('95,000 LBP'), 95000);
  assert.equal(parseNumber('Page 2'), null);
  assert.equal(parseNumber('12/03/2026'), null);
  assert.equal(parseNumber('1,23'), null);
});

test('parseDate reads ISO and en-GB formats used in the admin', () => {
  assert.equal(parseDate('2026-03-05'), Date.UTC(2026, 2, 5));
  assert.equal(parseDate('2026-03-05T10:20:30.000Z'), Date.UTC(2026, 2, 5, 10, 20, 30));
  assert.equal(parseDate('05/03/2026'), Date.UTC(2026, 2, 5));
  assert.equal(parseDate('05/03/2026, 14:07:09'), Date.UTC(2026, 2, 5, 14, 7, 9));
  assert.equal(parseDate('5 Mar 2026'), Date.UTC(2026, 2, 5));
  assert.equal(parseDate('5 Sept 2026, 09:15'), Date.UTC(2026, 8, 5, 9, 15));
  assert.equal(parseDate('31/02/2026'), null);
  assert.equal(parseDate('Published'), null);
});

test('placeholders count as empty', () => {
  for (const value of ['', '  ', '—', '-', 'Never', 'n/a']) {
    assert.equal(isEmptyValue(value), true, value);
  }
  assert.equal(isEmptyValue('Draft'), false);
});

test('detectType needs every non-empty value to match', () => {
  assert.equal(detectType(['3', '10', '—', '2']), 'number');
  assert.equal(detectType(['01/02/2026', '15/01/2026', 'Never']), 'date');
  assert.equal(detectType(['3', 'Draft']), 'text');
  assert.equal(detectType(['—', '']), 'text');
});

test('numbers sort numerically, not as text', () => {
  assert.deepEqual(pick(['10', '9', '100', '1'], 'ascending'), ['1', '9', '10', '100']);
  assert.deepEqual(pick(['10', '9', '100', '1'], 'descending'), ['100', '10', '9', '1']);
});

test('dates sort chronologically across formats', () => {
  const values = ['02/01/2026', '15/12/2025', '2026-01-01'];
  assert.deepEqual(pick(values, 'ascending'), ['15/12/2025', '2026-01-01', '02/01/2026']);
});

test('text sorts case-insensitively with natural numbers', () => {
  assert.deepEqual(pick(['beta', 'Alpha', 'item 10', 'item 2'], 'ascending'), ['Alpha', 'beta', 'item 2', 'item 10']);
});

test('empty values stay last in both directions', () => {
  assert.deepEqual(pick(['b', '—', 'a'], 'ascending'), ['a', 'b', '—']);
  assert.deepEqual(pick(['b', '—', 'a'], 'descending'), ['b', 'a', '—']);
});

test('equal values keep their original order', () => {
  const values = ['Draft', 'Published', 'draft', 'Published'];
  assert.deepEqual(sortIndexes(values, 'ascending'), [0, 2, 1, 3]);
  assert.deepEqual(sortIndexes(values, 'descending'), [1, 3, 0, 2]);
});

test('clicking cycles ascending, descending, original', () => {
  assert.equal(nextDirection(null), 'ascending');
  assert.equal(nextDirection('ascending'), 'descending');
  assert.equal(nextDirection('descending'), null);
});
