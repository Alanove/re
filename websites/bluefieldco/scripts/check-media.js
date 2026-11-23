const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');

const root = path.resolve(__dirname, '..');
const nodeRequire = createRequire(__filename);

function libcFamily() {
  if (process.platform !== 'linux') {
    return 'n/a';
  }
  const report = process.report.getReport();
  const glibc = report.header && report.header.glibcVersionRuntime;
  return glibc ? `glibc ${glibc}` : 'musl';
}

function nativeBackendPackage() {
  const os = process.platform === 'linux' && libcFamily() === 'musl' ? 'linuxmusl' : process.platform;
  return `@img/sharp-${os}-${process.arch}`;
}

function hasNativeBackend() {
  try {
    nodeRequire.resolve(`${nativeBackendPackage()}/package`);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const sharp = require('sharp');
  const backend = hasNativeBackend() ? 'native' : 'wasm';
  console.log(`platform     ${process.platform}`);
  console.log(`arch         ${process.arch}`);
  console.log(`libc         ${libcFamily()}`);
  console.log(`node         ${process.versions.node}`);
  console.log(`sharp        ${sharp.versions.sharp}`);
  console.log(`libvips      ${sharp.versions.vips}`);
  console.log(`backend      ${backend}`);
  if (backend !== 'native') {
    throw new Error(`The native sharp binary for ${process.platform}-${process.arch} is missing, so images would use the slow WebAssembly fallback. Run "npm ci" on this server without --omit=optional.`);
  }
  if (!sharp.format.webp || !sharp.format.webp.output || !sharp.format.webp.output.buffer) {
    throw new Error('libvips was built without WebP output support.');
  }

  const sample = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#123456' } }).jpeg().toBuffer();
  const webp = await sharp(sample).webp().toBuffer();
  const isWebp = webp.subarray(0, 4).toString('ascii') === 'RIFF' && webp.subarray(8, 12).toString('ascii') === 'WEBP';
  if (!isWebp) {
    throw new Error('Sample conversion did not produce a WebP image.');
  }
  console.log('conversion   JPEG -> WebP');

  const dirs = [
    'public/pages',
    'public/projects',
    'public/news',
    'public/images',
    'public/downloads',
    'public/videos',
    'public/temp'
  ];
  for (const dir of dirs) {
    const abs = path.join(root, dir);
    fs.mkdirSync(abs, { recursive: true });
    const probe = path.join(abs, `.media-check-${process.pid}`);
    fs.writeFileSync(probe, 'ok');
    fs.unlinkSync(probe);
    console.log(`writable     ${dir}`);
  }
  console.log('Media check passed.');
}

main().catch((error) => {
  console.error('Media check failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
