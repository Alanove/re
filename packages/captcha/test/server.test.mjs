import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { loadModule } from './load.mjs';

const captcha = await loadModule('src/server/captcha.ts');
const SECRET = 'test-secret-0123456789abcdef0123456789abcdef';

function solve(challenge) {
  for (let n = 0; n <= challenge.maxNumber; n++) {
    if (createHash('sha256').update(`${challenge.salt}${n}`).digest('hex') === challenge.challenge) {
      return n;
    }
  }
  throw new Error('no solution');
}

function solvedToken(options = {}) {
  const challenge = captcha.createChallenge({ secret: SECRET, scope: 'contact', maxNumber: 5_000, ...options });
  const number = solve(challenge);
  return {
    challenge,
    number,
    token: captcha.encodeCaptchaPayload({ ...challenge, number, maxNumber: undefined })
  };
}

test('a solved challenge verifies once for its scope', () => {
  const { token } = solvedToken();
  const replayStore = new captcha.MemoryReplayStore();
  assert.deepEqual(captcha.verifyCaptcha(token, { secret: SECRET, scope: 'contact', replayStore }), { ok: true, scope: 'contact' });
  assert.deepEqual(captcha.verifyCaptcha(token, { secret: SECRET, scope: 'contact', replayStore }), { ok: false, reason: 'replayed' });
});

test('missing and malformed tokens are rejected', () => {
  assert.equal(captcha.verifyCaptcha('', { secret: SECRET, scope: 'contact' }).reason, 'missing');
  assert.equal(captcha.verifyCaptcha(undefined, { secret: SECRET, scope: 'contact' }).reason, 'missing');
  assert.equal(captcha.verifyCaptcha('not-base64-json', { secret: SECRET, scope: 'contact' }).reason, 'malformed');
  assert.equal(captcha.verifyCaptcha('x'.repeat(5_000), { secret: SECRET, scope: 'contact' }).reason, 'malformed');
});

test('a wrong answer is rejected', () => {
  const { challenge, number } = solvedToken();
  const token = captcha.encodeCaptchaPayload({ ...challenge, number: number + 1 });
  assert.equal(captcha.verifyCaptcha(token, { secret: SECRET, scope: 'contact' }).reason, 'wrong-answer');
});

test('a tampered signature or a different secret is rejected', () => {
  const { challenge, number } = solvedToken();
  const flipped = challenge.signature.slice(0, -1) + (challenge.signature.endsWith('0') ? '1' : '0');
  const tampered = captcha.encodeCaptchaPayload({ ...challenge, number, signature: flipped });
  assert.equal(captcha.verifyCaptcha(tampered, { secret: SECRET, scope: 'contact' }).reason, 'bad-signature');
  const { token } = solvedToken();
  assert.equal(captcha.verifyCaptcha(token, { secret: `${SECRET}-other`, scope: 'contact' }).reason, 'bad-signature');
});

test('changing the salt (expiry or scope) breaks the signature check', () => {
  const { challenge, number } = solvedToken();
  const parts = challenge.salt.split('.');
  const forged = captcha.encodeCaptchaPayload({ ...challenge, number, salt: `${parts[0]}.${parts[1]}.admin-login` });
  assert.equal(captcha.verifyCaptcha(forged, { secret: SECRET, scope: 'admin-login' }).reason, 'wrong-answer');
});

test('expired tokens are rejected', () => {
  const now = Date.now();
  const { token } = solvedToken({ ttlMs: 1_000, now });
  assert.equal(captcha.verifyCaptcha(token, { secret: SECRET, scope: 'contact', now: now + 1_001 }).reason, 'expired');
});

test('a token for another scope is rejected', () => {
  const { token } = solvedToken();
  assert.equal(captcha.verifyCaptcha(token, { secret: SECRET, scope: 'admin-login' }).reason, 'wrong-scope');
});

test('options are validated', () => {
  assert.throws(() => captcha.createChallenge({ secret: 'short', scope: 'contact' }), /at least 32/);
  assert.throws(() => captcha.createChallenge({ secret: SECRET, scope: 'Bad Scope' }), /Invalid captcha scope/);
  assert.throws(() => captcha.createChallenge({ secret: SECRET, scope: 'contact', maxNumber: 10 }), /maxNumber/);
  assert.throws(() => captcha.createChallenge({ secret: SECRET, scope: 'contact', ttlMs: 10 }), /ttlMs/);
  assert.equal(captcha.isValidScope('admin-login'), true);
  assert.equal(captcha.isValidScope('../x'), false);
});

test('the replay store frees entries after they expire', () => {
  const store = new captcha.MemoryReplayStore(2);
  assert.equal(store.claim('a', 100, 0), true);
  assert.equal(store.claim('b', 100, 0), true);
  assert.equal(store.claim('c', 100, 50), false, 'full store refuses new keys');
  assert.equal(store.claim('c', 300, 150), true, 'expired keys are pruned');
  assert.equal(store.size, 1);
});
