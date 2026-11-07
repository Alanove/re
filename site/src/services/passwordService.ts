import { randomBytes, scrypt as scryptCallback, timingSafeEqual, type ScryptOptions } from 'node:crypto';

const KEY_LENGTH = 64;
const PARAMS = { N: 16384, r: 8, p: 1 } as const;

function scrypt(password: string, salt: Buffer, keyLength: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keyLength, { ...options, maxmem: 64 * 1024 * 1024 }, (error, derived) => {
      if (error) {
        reject(error);
      } else {
        resolve(derived);
      }
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, KEY_LENGTH, PARAMS);
  return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt.toString('base64')}$${derived.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') {
    return false;
  }
  const [, n, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64 ?? '', 'base64');
  const derived = await scrypt(password, Buffer.from(saltB64 ?? '', 'base64'), expected.length || KEY_LENGTH, {
    N: Number(n),
    r: Number(r),
    p: Number(p)
  });
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

let dummyHash: Promise<string> | null = null;

export async function burnPasswordCheck(password: string): Promise<void> {
  dummyHash ??= hashPassword(randomBytes(16).toString('hex'));
  await verifyPassword(password, await dummyHash);
}
