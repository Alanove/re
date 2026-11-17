import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, 'dist');
const browserDist = path.join(distDir, 'browser');
const serverDist = path.join(distDir, 'server');

/**
 * `--public <dir>` copies the browser files (captcha.js, captcha-worker.js, captcha.css) into a site.
 * `--server <dir>` copies the server module (captcha.ts) into a site so the site's own tsc compiles it.
 * Both paths are relative to the current working directory.
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

const argv = process.argv.slice(2);
const publicOut = readDir(argv, '--public');
const serverOut = readDir(argv, '--server');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
const banner = `/* @local/captcha ${pkg.version} - generated from packages/captcha, do not edit */`;

fs.rmSync(distDir, { recursive: true, force: true });

const browserOptions = {
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2020'],
  minify: true,
  sourcemap: false,
  logLevel: 'info',
  banner: { js: banner }
};

await esbuild.build({
  ...browserOptions,
  entryPoints: [path.join(__dirname, 'src', 'client', 'index.ts')],
  outfile: path.join(browserDist, 'captcha.js')
});

await esbuild.build({
  ...browserOptions,
  entryPoints: [path.join(__dirname, 'src', 'client', 'worker.ts')],
  outfile: path.join(browserDist, 'captcha-worker.js')
});

fs.cpSync(path.join(__dirname, 'styles', 'captcha.css'), path.join(browserDist, 'captcha.css'));

fs.mkdirSync(serverDist, { recursive: true });
const serverSource = fs.readFileSync(path.join(__dirname, 'src', 'server', 'captcha.ts'), 'utf8');
fs.writeFileSync(path.join(serverDist, 'captcha.ts'), `${banner}\n${serverSource}`);

console.log('Built dist/browser (captcha.js, captcha-worker.js, captcha.css) and dist/server (captcha.ts)');

if (publicOut) {
  fs.rmSync(publicOut, { recursive: true, force: true });
  fs.mkdirSync(publicOut, { recursive: true });
  fs.cpSync(browserDist, publicOut, { recursive: true });
  console.log(`Copied browser files to ${publicOut}`);
}

if (serverOut) {
  fs.rmSync(serverOut, { recursive: true, force: true });
  fs.mkdirSync(serverOut, { recursive: true });
  fs.cpSync(serverDist, serverOut, { recursive: true });
  console.log(`Copied server module to ${serverOut}`);
}
