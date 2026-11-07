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
  outfile: path.join(distDir, 'editor.js'),
  format: 'iife',
  globalName: 'RichTextEditorBundle',
  platform: 'browser',
  target: ['es2020'],
  minify: true,
  sourcemap: false,
  logLevel: 'info',
  banner: {
    js: '/* RichTextEditor (light) */',
  },
});

const ASSETS = [
  ['styles/editor.css', 'editor.css'],
  ['styles/rte-content.css', 'rte-content.css'],
  ['templates/templates.json', 'templates.json'],
  ['templates/placeholder.svg', 'placeholder.svg'],
  ['icons', 'icons'],
];

for (const [from, to] of ASSETS) {
  fs.cpSync(path.join(__dirname, from), path.join(distDir, to), { recursive: true });
}

console.log('Built dist/ (editor.js, editor.css, rte-content.css, templates.json, placeholder.svg, icons/)');

if (outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.cpSync(distDir, outDir, { recursive: true });
  console.log(`Copied dist/ to ${outDir}`);
}
