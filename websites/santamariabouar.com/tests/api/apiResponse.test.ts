import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isIsoDate, paginate, parseId, parsePagination } from '../../src/api/utils/apiResponse';

test('paginate slices and reports hasMore', () => {
  const items = Array.from({ length: 30 }, (_, i) => i);
  const first = paginate(items, 1, 25);
  assert.equal(first.items.length, 25);
  assert.equal(first.hasMore, true);
  const second = paginate(items, 2, 25);
  assert.deepEqual(second.items, [25, 26, 27, 28, 29]);
  assert.equal(second.hasMore, false);
  assert.equal(second.total, 30);
});

test('parsePagination clamps page size', () => {
  assert.deepEqual(parsePagination({ page: '0', pageSize: '1000' } as any), { page: 1, pageSize: 100 });
  assert.deepEqual(parsePagination({} as any), { page: 1, pageSize: 25 });
});

test('parseId only accepts positive integers', () => {
  assert.equal(parseId('12'), 12);
  assert.equal(parseId('0'), null);
  assert.equal(parseId('-3'), null);
  assert.equal(parseId('abc'), null);
});

test('isIsoDate accepts YYYY-MM-DD only', () => {
  assert.equal(isIsoDate('2026-10-17'), true);
  assert.equal(isIsoDate('17/10/2026'), false);
  assert.equal(isIsoDate('2026-13-45'), false);
  assert.equal(isIsoDate(undefined), false);
});
