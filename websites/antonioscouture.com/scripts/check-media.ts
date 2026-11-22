/**
 * Verify native sharp, WebP conversion, and a writable uploads folder.
 * Used by deploy as `media:check:prod` after the site restarts.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DATA_PATHS } from '../src/constants/data-paths';

function isWebp(buffer: Buffer): boolean {
  return buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
}

async function main(): Promise<void> {
  let sharp: typeof import('sharp');
  try {
    const mod = await import('sharp');
    sharp = ((mod as { default?: typeof import('sharp') }).default || mod) as typeof import('sharp');
  } catch (e) {
    console.error('Media check failed: could not load sharp.', {
      platform: process.platform,
      arch: process.arch,
      node: process.version,
      error: e instanceof Error ? e.message : e,
    });
    process.exitCode = 1;
    return;
  }

  const versions = (sharp as { versions?: Record<string, string> }).versions || {};
  console.info('Image runtime');
  console.info(`  platform     ${process.platform}`);
  console.info(`  arch         ${process.arch}`);
  console.info(`  node         ${process.version}`);
  console.info(`  sharp        ${versions.sharp || 'unknown'}`);
  console.info(`  vips         ${versions.vips || 'unknown'}`);

  const vendorPath = path.join(process.cwd(), 'node_modules', '@img');
  const nativeHint = fs.existsSync(vendorPath)
    ? fs.readdirSync(vendorPath).filter((n) => n.startsWith('sharp-')).join(', ')
    : '(none)';
  console.info(`  @img         ${nativeHint || '(none)'}`);
  if (!nativeHint || nativeHint === '(none)') {
    throw new Error(
      `The native sharp binary for ${process.platform}-${process.arch} is missing. Run "npm ci" without --omit=optional.`
    );
  }
  if (/wasm32/i.test(nativeHint) && !/(linux|darwin|win32)/i.test(nativeHint)) {
    throw new Error(
      `The native sharp binary for ${process.platform}-${process.arch} is missing (found: ${nativeHint}). Run "npm ci" without --omit=optional.`
    );
  }

  const sample = await sharp({
    create: { width: 640, height: 480, channels: 3, background: '#1a1a1a' },
  })
    .jpeg()
    .toBuffer();
  const webp = await sharp(sample).webp({ quality: 80 }).toBuffer();
  if (!isWebp(webp)) {
    throw new Error('Sample conversion did not produce WebP output.');
  }
  console.info(`  conversion   JPEG 640x480 -> WebP ${webp.length} bytes`);

  const uploadsDir = path.join(DATA_PATHS.PUBLIC_DIR, 'uploads');
  fs.mkdirSync(uploadsDir, { recursive: true });
  const probeDir = path.join(uploadsDir, '.media-check');
  fs.mkdirSync(probeDir, { recursive: true });
  const probeFile = path.join(probeDir, `probe-${process.pid}.webp`);
  fs.writeFileSync(probeFile, webp);
  fs.unlinkSync(probeFile);
  fs.rmdirSync(probeDir);
  console.info(`  uploads      ${uploadsDir} is writable`);
  console.info(`  hostname     ${os.hostname()}`);
  console.info('Media check passed.');
}

main().catch((error) => {
  console.error('Media check failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
