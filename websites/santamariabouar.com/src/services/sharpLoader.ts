/**
 * Lazy-load sharp so the app can start on CPUs that lack x86-64-v2
 * (sharp's default linux-x64 prebuilds require SSE4.2).
 *
 * Prefer installing `@img/sharp-wasm32` on those hosts.
 */
type SharpModule = typeof import('sharp');

let sharpModule: SharpModule | null | undefined;

export function getSharp(): SharpModule | null {
  if (sharpModule !== undefined) {
    return sharpModule;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    sharpModule = require('sharp') as SharpModule;
    return sharpModule;
  } catch (error) {
    console.warn(
      '[sharp] Native module unavailable (install @img/sharp-wasm32 on older CPUs). Image resize/validation disabled.',
      error instanceof Error ? error.message : error
    );
    sharpModule = null;
    return null;
  }
}

export function isSharpAvailable(): boolean {
  return getSharp() !== null;
}
