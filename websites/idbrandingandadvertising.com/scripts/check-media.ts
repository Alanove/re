import 'dotenv/config';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { PATHS } from '../src/config/paths.js';
import { IMAGE_PRESETS, imageProcessingService } from '../src/services/imageProcessingService.js';

function isWebp(buffer: Buffer): boolean {
  return buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
}

async function main(): Promise<void> {
  const report = await imageProcessingService.report();
  console.info('Image runtime');
  for (const [key, value] of Object.entries(report)) {
    console.info(`  ${key.padEnd(12)} ${String(value)}`);
  }
  if (report.backend !== 'native') {
    throw new Error(`The native sharp binary for ${report.platform}-${report.arch} is missing, so images would use the slow WebAssembly fallback. Run "npm ci" on this server without --omit=optional.`);
  }
  if (!report.webp) {
    throw new Error('libvips was built without WebP output support.');
  }

  const sample = await sharp({ create: { width: 2400, height: 1600, channels: 3, background: '#006293' } }).jpeg().toBuffer();
  const processed = await imageProcessingService.process(sample, 'card', 'Sample image');
  const expected = IMAGE_PRESETS.card.width;
  if (!isWebp(processed.main.buffer) || processed.main.width !== expected || !processed.thumb || !isWebp(processed.thumb.buffer)) {
    throw new Error(`Sample conversion produced an unexpected result (${processed.main.width}x${processed.main.height}).`);
  }
  console.info(`  conversion   JPEG 2400x1600 -> WebP ${processed.main.width}x${processed.main.height} + thumb ${processed.thumb.width}x${processed.thumb.height}`);

  const probeDir = path.join(PATHS.uploads, '.media-check');
  await mkdir(probeDir, { recursive: true });
  await writeFile(path.join(probeDir, 'probe.webp'), processed.main.buffer);
  await rm(probeDir, { recursive: true, force: true });
  console.info(`  uploads      ${PATHS.uploads} is writable`);
  console.info('Media check passed.');
}

try {
  await main();
} catch (error) {
  console.error('Media check failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
