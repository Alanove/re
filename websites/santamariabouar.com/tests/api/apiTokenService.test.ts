import { test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import {
  getJwtSecret,
  hashRefreshToken,
  signAccessToken,
  verifyAccessToken
} from '../../src/api/services/apiTokenService';

const SECRET = 'test-secret-that-is-long-enough-for-production-use';

test('access token round-trips user id and role', () => {
  const token = signAccessToken(42, 'Member', SECRET);
  assert.deepEqual(verifyAccessToken(token, SECRET), { userId: 42, role: 'Member' });
});

test('access token signed with another secret is rejected', () => {
  const token = signAccessToken(42, 'Member', SECRET);
  assert.equal(verifyAccessToken(token, 'some-other-secret'), null);
});

test('token without the access type claim is rejected', () => {
  const token = jwt.sign({ role: 'Super Admin' }, SECRET, { subject: '1', issuer: 'santamariabouar-api' });
  assert.equal(verifyAccessToken(token, SECRET), null);
});

test('expired access token is rejected', () => {
  const token = jwt.sign({ role: 'Member', typ: 'access' }, SECRET, {
    subject: '7',
    issuer: 'santamariabouar-api',
    expiresIn: -10
  });
  assert.equal(verifyAccessToken(token, SECRET), null);
});

test('garbage tokens are rejected', () => {
  assert.equal(verifyAccessToken('not-a-jwt', SECRET), null);
});

test('refresh token hash is deterministic sha256 hex', () => {
  assert.equal(hashRefreshToken('abc'), hashRefreshToken('abc'));
  assert.match(hashRefreshToken('abc'), /^[0-9a-f]{64}$/);
  assert.notEqual(hashRefreshToken('abc'), hashRefreshToken('abd'));
});

test('production requires a strong JWT_SECRET', () => {
  const saved = { env: process.env.NODE_ENV, secret: process.env.JWT_SECRET };
  try {
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_SECRET;
    assert.equal(getJwtSecret(), null);
    process.env.JWT_SECRET = 'short';
    assert.equal(getJwtSecret(), null);
    process.env.JWT_SECRET = SECRET;
    assert.equal(getJwtSecret(), SECRET);

    process.env.NODE_ENV = 'development';
    delete process.env.JWT_SECRET;
    assert.ok(getJwtSecret());
  } finally {
    process.env.NODE_ENV = saved.env;
    if (saved.secret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = saved.secret;
  }
});
