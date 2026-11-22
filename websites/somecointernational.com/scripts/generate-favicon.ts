/**
 * Crop the Someco logo mark (left icon only) into a 512px PNG favicon.
 * Usage: npx tsx scripts/generate-favicon.ts
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(root, 'public', 'uploads', 'site', 'logo-source.png');
const destPath = path.join(root, 'public', 'uploads', 'site', 'favicon.png');

function isInk(r: number, g: number, b: number, a: number): boolean {
  return a >= 20 && !(r > 240 && g > 240 && b > 240);
}

function isGray(r: number, g: number, b: number): boolean {
  return Math.abs(r - g) < 25 && Math.abs(g - b) < 25 && r > 130 && r < 230;
}

/** Mark = left blue curves + gray pillar; stop before the Someco wordmark. Height stops before INTERNATIONAL. */
async function markBox(source: Buffer): Promise<{ width: number; height: number }> {
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const width = info.width;
  const height = info.height;
  const channels = info.channels;

  let lastGray = -1;
  for (let x = 0; x < width; x += 1) {
    let gray = 0;
    for (let y = 0; y < height; y += 1) {
      const i = (y * width + x) * channels;
      const r = data[i] ?? 255;
      const g = data[i + 1] ?? 255;
      const b = data[i + 2] ?? 255;
      const a = data[i + 3] ?? 255;
      if (isInk(r, g, b, a) && isGray(r, g, b)) {
        gray += 1;
      }
    }
    if (gray >= Math.floor(height * 0.3)) {
      lastGray = x;
    }
  }

  let started = false;
  let cropHeight = height;
  for (let y = 0; y < height; y += 1) {
    let ink = 0;
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * channels;
      if (isInk(data[i] ?? 255, data[i + 1] ?? 255, data[i + 2] ?? 255, data[i + 3] ?? 255)) {
        ink += 1;
      }
    }
    if (ink > 0) {
      started = true;
    } else if (started) {
      cropHeight = y;
      break;
    }
  }

  const cropWidth = lastGray >= 0 ? lastGray + 1 : Math.max(1, Math.round(width * 0.33));
  return { width: cropWidth, height: Math.max(1, cropHeight) };
}

export async function generateFavicon(
  sourceFile = sourcePath,
  destFile = destPath
): Promise<{ url: string; width: number; height: number }> {
  const source = await readFile(sourceFile);
  const box = await markBox(source);
  const side = Math.max(box.width, box.height);
  const padX = Math.floor((side - box.width) / 2);
  const padY = Math.floor((side - box.height) / 2);
  const png = await sharp(source)
    .extract({ left: 0, top: 0, width: box.width, height: box.height })
    .extend({
      top: padY,
      bottom: side - box.height - padY,
      left: padX,
      right: side - box.width - padX,
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    })
    .resize(512, 512, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png()
    .toBuffer();
  await mkdir(path.dirname(destFile), { recursive: true });
  await writeFile(destFile, png);
  const rel = `/uploads/site/${path.basename(destFile)}`.replace(/\\/g, '/');
  return { url: rel, width: 512, height: 512 };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = await generateFavicon();
  console.info(`Wrote ${out.url} (${out.width}x${out.height})`);
}
