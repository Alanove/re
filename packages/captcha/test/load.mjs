import * as esbuild from 'esbuild';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Bundles a TypeScript entry from src/ into a temporary ES module and imports it. */
export async function loadModule(relativeEntry, platform = 'node') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'captcha-test-'));
  const outfile = path.join(dir, 'module.mjs');
  await esbuild.build({
    entryPoints: [path.join(__dirname, '..', relativeEntry)],
    bundle: true,
    format: 'esm',
    platform,
    target: ['node20'],
    outfile,
    logLevel: 'silent'
  });
  return import(pathToFileURL(outfile).href);
}
