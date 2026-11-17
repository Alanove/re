import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import test from 'node:test';
import { loadModule } from './load.mjs';

const { sha256Hex, createMatcher } = await loadModule('src/client/sha256.ts', 'neutral');
const solver = await loadModule('src/client/solver.ts', 'neutral');
const server = await loadModule('src/server/captcha.ts');

const nodeSha = (value) => createHash('sha256').update(value, 'utf8').digest('hex');

test('browser SHA-256 matches Node crypto for many lengths', () => {
  for (let length = 0; length < 200; length++) {
    const value = randomBytes(length).toString('base64').slice(0, length);
    assert.equal(sha256Hex(value), nodeSha(value), `length ${length}`);
  }
  assert.equal(sha256Hex('héllo مرحبا'), nodeSha('héllo مرحبا'));
});

test('the fast matcher agrees with Node crypto, including around block boundaries', () => {
  for (let prefixLength = 40; prefixLength < 70; prefixLength++) {
    const prefix = 'a'.repeat(prefixLength);
    for (const n of [0, 7, 42, 999, 123456, 9999999]) {
      const matches = createMatcher(prefix, nodeSha(`${prefix}${n}`));
      assert.equal(matches(n), true, `prefix ${prefixLength}, n ${n}`);
      assert.equal(matches(n + 1), false);
    }
  }
});

test('the browser solver finds the number the server hid', async () => {
  const challenge = server.createChallenge({ secret: 'x'.repeat(32), scope: 'contact', maxNumber: 3_000 });
  const result = await solver.solveInSlices(challenge, 500);
  assert.ok(result);
  const token = server.encodeCaptchaPayload({ ...challenge, number: result.number });
  assert.equal(server.verifyCaptcha(token, { secret: 'x'.repeat(32), scope: 'contact' }).ok, true);
});
