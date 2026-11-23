import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, 'dist');
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
const banner = `/* @local/email-sender ${pkg.version} - generated from packages/email-sender, do not edit */\n`;

/**
 * `--out <dir>` copies the TypeScript module into a site so the site's own tsc compiles it.
 * Path is relative to the current working directory.
 */
function readDir(argv, flag) {
  const index = argv.indexOf(flag);
  if (index === -1) {
    return null;
  }
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${flag} requires a directory path`);
  }
  return path.resolve(process.cwd(), value);
}

const outDir = readDir(process.argv.slice(2), '--out');
const source = fs.readFileSync(path.join(__dirname, 'src', 'createMailer.ts'), 'utf8');

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });
fs.writeFileSync(path.join(distDir, 'createMailer.ts'), `${banner}${source}`);
console.log('Built dist/createMailer.ts');

if (outDir) {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  fs.cpSync(distDir, outDir, { recursive: true });
  console.log(`Copied module to ${outDir}`);
}
