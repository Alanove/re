import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

export const CAPTCHA_ALGORITHM = 'SHA-256';
export const CAPTCHA_DEFAULT_MAX_NUMBER = 100_000;
export const CAPTCHA_DEFAULT_TTL_MS = 10 * 60_000;
export const CAPTCHA_MIN_SECRET_LENGTH = 32;
export const CAPTCHA_MAX_PAYLOAD_LENGTH = 2_000;

const SCOPE_PATTERN = /^[a-z0-9][a-z0-9-]{0,39}$/;
const HEX_PATTERN = /^[a-f0-9]+$/;

export interface CaptchaChallenge {
  algorithm: typeof CAPTCHA_ALGORITHM;
  challenge: string;
  maxNumber: number;
  salt: string;
  signature: string;
}

export interface CaptchaSolution {
  algorithm: typeof CAPTCHA_ALGORITHM;
  challenge: string;
  number: number;
  salt: string;
  signature: string;
}

export type CaptchaFailureReason =
  | 'missing'
  | 'malformed'
  | 'bad-signature'
  | 'expired'
  | 'wrong-scope'
  | 'wrong-answer'
  | 'replayed';

export type CaptchaVerifyResult = { ok: true; scope: string } | { ok: false; reason: CaptchaFailureReason };

export interface CreateChallengeOptions {
  secret: string;
  scope: string;
  maxNumber?: number;
  ttlMs?: number;
  now?: number;
}

export interface VerifyOptions {
  secret: string;
  scope: string;
  replayStore?: CaptchaReplayStore;
  now?: number;
}

export interface CaptchaReplayStore {
  /** Records the key and returns false when it was already used and has not expired. */
  claim(key: string, expiresAt: number, now: number): boolean;
}

export function isValidScope(scope: string): boolean {
  return SCOPE_PATTERN.test(scope);
}

export function assertCaptchaSecret(secret: string): void {
  if (typeof secret !== 'string' || secret.length < CAPTCHA_MIN_SECRET_LENGTH) {
    throw new Error(`Captcha secret must be at least ${CAPTCHA_MIN_SECRET_LENGTH} characters.`);
  }
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function sign(secret: string, challenge: string): string {
  return createHmac('sha256', secret).update(challenge, 'utf8').digest('hex');
}

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length || !HEX_PATTERN.test(a) || !HEX_PATTERN.test(b)) {
    return false;
  }
  return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

/** The salt carries a random nonce, the expiry time and the scope, so the signature covers all three. */
function buildSalt(scope: string, expiresAt: number): string {
  return `${randomBytes(12).toString('hex')}.${expiresAt.toString(36)}.${scope}`;
}

function parseSalt(salt: string): { expiresAt: number; scope: string } | null {
  const parts = salt.split('.');
  if (parts.length !== 3) {
    return null;
  }
  const [nonce, expiry, scope] = parts as [string, string, string];
  if (!/^[a-f0-9]{24}$/.test(nonce) || !/^[a-z0-9]{1,12}$/.test(expiry) || !isValidScope(scope)) {
    return null;
  }
  const expiresAt = parseInt(expiry, 36);
  return Number.isSafeInteger(expiresAt) ? { expiresAt, scope } : null;
}

export function createChallenge(options: CreateChallengeOptions): CaptchaChallenge {
  assertCaptchaSecret(options.secret);
  if (!isValidScope(options.scope)) {
    throw new Error(`Invalid captcha scope "${options.scope}".`);
  }
  const maxNumber = Math.floor(options.maxNumber ?? CAPTCHA_DEFAULT_MAX_NUMBER);
  if (!Number.isSafeInteger(maxNumber) || maxNumber < 1_000 || maxNumber > 10_000_000) {
    throw new Error('Captcha maxNumber must be between 1000 and 10000000.');
  }
  const ttlMs = Math.floor(options.ttlMs ?? CAPTCHA_DEFAULT_TTL_MS);
  if (!Number.isSafeInteger(ttlMs) || ttlMs < 1_000 || ttlMs > 24 * 60 * 60_000) {
    throw new Error('Captcha ttlMs must be between 1 second and 24 hours.');
  }
  const now = options.now ?? Date.now();
  const salt = buildSalt(options.scope, now + ttlMs);
  const challenge = sha256Hex(`${salt}${randomInt(0, maxNumber + 1)}`);
  return { algorithm: CAPTCHA_ALGORITHM, challenge, maxNumber, salt, signature: sign(options.secret, challenge) };
}

/** Decodes the base64url JSON payload the browser widget puts in the hidden `captcha` field. */
export function decodeCaptchaPayload(token: string): CaptchaSolution | null {
  if (typeof token !== 'string' || token.length === 0 || token.length > CAPTCHA_MAX_PAYLOAD_LENGTH) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return null;
  }
  const value = parsed as Record<string, unknown>;
  if (
    value.algorithm !== CAPTCHA_ALGORITHM ||
    typeof value.challenge !== 'string' ||
    typeof value.salt !== 'string' ||
    typeof value.signature !== 'string' ||
    typeof value.number !== 'number' ||
    !Number.isSafeInteger(value.number) ||
    value.number < 0
  ) {
    return null;
  }
  return {
    algorithm: CAPTCHA_ALGORITHM,
    challenge: value.challenge,
    number: value.number,
    salt: value.salt,
    signature: value.signature
  };
}

export function encodeCaptchaPayload(solution: CaptchaSolution): string {
  return Buffer.from(JSON.stringify(solution), 'utf8').toString('base64url');
}

export function verifyCaptcha(token: string | undefined | null, options: VerifyOptions): CaptchaVerifyResult {
  assertCaptchaSecret(options.secret);
  if (!token) {
    return { ok: false, reason: 'missing' };
  }
  const solution = decodeCaptchaPayload(token);
  if (!solution) {
    return { ok: false, reason: 'malformed' };
  }
  const salt = parseSalt(solution.salt);
  if (!salt || solution.challenge.length !== 64) {
    return { ok: false, reason: 'malformed' };
  }
  if (!safeEqualHex(sign(options.secret, solution.challenge), solution.signature)) {
    return { ok: false, reason: 'bad-signature' };
  }
  const now = options.now ?? Date.now();
  if (salt.expiresAt <= now) {
    return { ok: false, reason: 'expired' };
  }
  if (salt.scope !== options.scope) {
    return { ok: false, reason: 'wrong-scope' };
  }
  if (!safeEqualHex(sha256Hex(`${solution.salt}${solution.number}`), solution.challenge)) {
    return { ok: false, reason: 'wrong-answer' };
  }
  if (options.replayStore && !options.replayStore.claim(solution.signature, salt.expiresAt, now)) {
    return { ok: false, reason: 'replayed' };
  }
  return { ok: true, scope: salt.scope };
}

/**
 * In-memory single-use store. It is per Node process, so a site running several
 * processes behind a load balancer needs a shared store implementing CaptchaReplayStore.
 */
export class MemoryReplayStore implements CaptchaReplayStore {
  private readonly used = new Map<string, number>();
  private readonly maxEntries: number;

  constructor(maxEntries = 100_000) {
    this.maxEntries = maxEntries;
  }

  public claim(key: string, expiresAt: number, now: number): boolean {
    const existing = this.used.get(key);
    if (existing !== undefined && existing > now) {
      return false;
    }
    if (this.used.size >= this.maxEntries) {
      this.prune(now);
    }
    if (this.used.size >= this.maxEntries) {
      return false;
    }
    this.used.set(key, expiresAt);
    return true;
  }

  public get size(): number {
    return this.used.size;
  }

  public prune(now: number): void {
    for (const [key, expiresAt] of this.used) {
      if (expiresAt <= now) {
        this.used.delete(key);
      }
    }
  }
}
