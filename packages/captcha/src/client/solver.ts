import { createMatcher } from './sha256';

export interface ChallengeData {
  algorithm: string;
  challenge: string;
  maxNumber: number;
  salt: string;
  signature: string;
}

export interface SolveResult {
  number: number;
  attempts: number;
}

/** Brute-forces the number in [start, maxNumber] whose hash with the salt matches the challenge. */
export function solveRange(data: ChallengeData, start: number, end: number): number | null {
  const matches = createMatcher(data.salt, data.challenge);
  for (let n = start; n <= end; n++) {
    if (matches(n)) {
      return n;
    }
  }
  return null;
}

/** Main-thread fallback when Workers are blocked: solves in slices so the page stays responsive. */
export function solveInSlices(data: ChallengeData, sliceSize = 2_000): Promise<SolveResult | null> {
  return new Promise((resolve) => {
    let start = 0;
    const step = (): void => {
      const end = Math.min(start + sliceSize - 1, data.maxNumber);
      const found = solveRange(data, start, end);
      if (found !== null) {
        resolve({ number: found, attempts: found + 1 });
        return;
      }
      if (end >= data.maxNumber) {
        resolve(null);
        return;
      }
      start = end + 1;
      setTimeout(step, 0);
    };
    step();
  });
}
