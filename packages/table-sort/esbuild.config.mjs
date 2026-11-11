import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, 'dist');

/** `--out <dir>` copies the finished bundle into a host project (relative to the current working directory). */
function readOutDir(argv) {
  const index = argv.indexOf('--out');
  if (index === -1) {
    return null;
  }
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error('--out requires a directory path');
  }
  return path.resolve(process.cwd(), value);
}

const outDir = readOutDir(process.argv.slice(2));

fs.rmSync(distDir, { recursive: true, force: true });

await esbuild.build({
  entryPoints: [path.join(__dirname, 'src', 'index.ts')],
  bundle: true,
  outfile: path.join(distDir, 'table-sort.js'),
  format: 'iife',
  globalName: 'TableSortBundle',
  platform: 'browser',
  target: ['es2020'],
  minify: true,
  sourcemap: false,
  logLevel: 'info',
  banner: {
    js: '/* TableSort */',
  },
});

fs.cpSync(path.join(__dirname, 'styles', 'table-sort.css'), path.join(distDir, 'table-sort.css'));

console.log('Built dist/ (table-sort.js, table-sort.css)');

if (outDir) {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  fs.cpSync(distDir, outDir, { recursive: true });
  console.log(`Copied dist/ to ${outDir}`);
}
