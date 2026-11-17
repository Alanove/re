/**
 * Synchronous SHA-256. Used instead of crypto.subtle because subtle is async per call
 * (slow for many tiny hashes) and missing on plain-HTTP origins.
 */
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]);

const W = new Uint32Array(64);
const H = new Uint32Array(8);
const HEX = '0123456789abcdef';

/** Hashes data[0..length) into H. `data` must have room for the padding (length rounded up to 64 plus 64). */
function digest(data: Uint8Array, length: number): void {
  const paddedLength = ((length + 9 + 63) >> 6) << 6;
  data[length] = 0x80;
  data.fill(0, length + 1, paddedLength);
  const view = new DataView(data.buffer, data.byteOffset, paddedLength);
  const bitLength = length * 8;
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000));
  view.setUint32(paddedLength - 4, bitLength >>> 0);

  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let i = 0; i < 16; i++) {
      W[i] = view.getUint32(offset + i * 4);
    }
    for (let i = 16; i < 64; i++) {
      const w15 = W[i - 15]!;
      const w2 = W[i - 2]!;
      const s0 = ((w15 >>> 7) | (w15 << 25)) ^ ((w15 >>> 18) | (w15 << 14)) ^ (w15 >>> 3);
      const s1 = ((w2 >>> 17) | (w2 << 15)) ^ ((w2 >>> 19) | (w2 << 13)) ^ (w2 >>> 10);
      W[i] = (W[i - 16]! + s0 + W[i - 7]! + s1) | 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i]! + W[i]!) | 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) | 0;
    }
    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
    h5 = (h5 + f) | 0;
    h6 = (h6 + g) | 0;
    h7 = (h7 + h) | 0;
  }
  H[0] = h0;
  H[1] = h1;
  H[2] = h2;
  H[3] = h3;
  H[4] = h4;
  H[5] = h5;
  H[6] = h6;
  H[7] = h7;
}

function bufferFor(length: number): Uint8Array {
  return new Uint8Array((((length + 9 + 63) >> 6) << 6) + 64);
}

export function sha256Hex(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const data = bufferFor(bytes.length);
  data.set(bytes);
  digest(data, bytes.length);
  let out = '';
  for (let i = 0; i < 8; i++) {
    const word = H[i]!;
    for (let shift = 28; shift >= 0; shift -= 4) {
      out += HEX[(word >>> shift) & 0xf];
    }
  }
  return out;
}

/**
 * Returns a test for "sha256(prefix + n) === targetHex" that reuses one buffer and
 * compares raw words, which is several times faster than hashing strings in a loop.
 */
export function createMatcher(prefix: string, targetHex: string): (n: number) => boolean {
  const prefixBytes = new TextEncoder().encode(prefix);
  const data = bufferFor(prefixBytes.length + 16);
  data.set(prefixBytes);
  const target = new Uint32Array(8);
  for (let i = 0; i < 8; i++) {
    target[i] = parseInt(targetHex.slice(i * 8, i * 8 + 8), 16) >>> 0;
  }
  const digits = new Uint8Array(16);
  return (n: number): boolean => {
    let length = 0;
    let value = n;
    do {
      digits[length++] = 48 + (value % 10);
      value = Math.floor(value / 10);
    } while (value > 0);
    let offset = prefixBytes.length;
    while (length > 0) {
      data[offset++] = digits[--length]!;
    }
    digest(data, offset);
    return (
      H[0] === target[0] && H[1] === target[1] && H[2] === target[2] && H[3] === target[3] &&
      H[4] === target[4] && H[5] === target[5] && H[6] === target[6] && H[7] === target[7]
    );
  };
}
