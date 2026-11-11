import * as fs from 'fs';
import { createRequire } from 'module';
import * as path from 'path';
import type { Request, Response } from 'express';

const nodeRequire = createRequire(__filename);

/**
 * Node's global fetch (undici) cannot load file:// WASM URLs ("not implemented... yet...").
 * @jsquash/webp's default init uses fetch; preloading the .wasm from disk avoids that.
 */
function resolveJsquashWebpWasmPath(useSimd: boolean): string {
  const pkgJson = nodeRequire.resolve('@jsquash/webp/package.json');
  return path.join(path.dirname(pkgJson), 'codec', 'enc', useSimd ? 'webp_enc_simd.wasm' : 'webp_enc.wasm');
}

let jsquashWebpEncodeModulePromise: Promise<typeof import('@jsquash/webp/encode')> | null = null;

async function loadJsquashWebpEncode(): Promise<typeof import('@jsquash/webp/encode')> {
  if (!jsquashWebpEncodeModulePromise) {
    jsquashWebpEncodeModulePromise = (async () => {
      const webpEncode = await import('@jsquash/webp/encode');
      const { simd } = await import('wasm-feature-detect');
      const wasmPath = resolveJsquashWebpWasmPath(await simd());
      const wasmBinary = new Uint8Array(await fs.promises.readFile(wasmPath));
      await webpEncode.init({ wasmBinary });
      return webpEncode;
    })();
  }
  return jsquashWebpEncodeModulePromise;
}

const MB = 1024 * 1024;

/** Browsers often send camera/exports as application/octet-stream; allow common raster extensions. */
const SLIDER_IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp|tif{1,2}|heic|heif|avif)$/i;

export function isAllowedSliderUpload(file: { mimetype: string; originalname: string }): boolean {
  if (file.mimetype && file.mimetype.startsWith('image/')) {
    return true;
  }
  return SLIDER_IMAGE_EXT.test(path.extname(file.originalname || ''));
}

/** Max raw upload size before optimization (default 50MB). Large originals are resized/compressed after upload. */
export function getSliderUploadMaxBytes(): number {
  const raw = process.env.SLIDER_UPLOAD_MAX_BYTES;
  if (raw) {
    const n = parseInt(String(raw), 10);
    if (!Number.isNaN(n) && n > 0) {
      return n;
    }
  }
  return 50 * MB;
}

/** Max width in pixels after resize (default 2500). Height scales proportionally. */
export function getSliderImageMaxWidth(): number {
  const n = parseInt(process.env.SLIDER_IMAGE_MAX_WIDTH || '2500', 10);
  return !Number.isNaN(n) && n > 0 ? n : 2500;
}

/** WebP quality 1–100 (default 82). SLIDER_JPEG_QUALITY is still read as a fallback for existing env files. */
export function getSliderWebpQuality(): number {
  const raw = process.env.SLIDER_WEBP_QUALITY ?? process.env.SLIDER_JPEG_QUALITY;
  const n = parseInt(raw || '82', 10);
  if (Number.isNaN(n) || n < 1) return 82;
  return n > 100 ? 100 : n;
}

export function respondSliderUploadError(req: Request, res: Response, message: string): void {
  const isApi = req.originalUrl.includes('/api/slider/upload-image');
  if (isApi) {
    res.status(400).json({ error: message });
    return;
  }
  const p = req.path;
  let target = `/admin/slider?error=${encodeURIComponent(message)}`;
  if (p === '/slider/create' || p.endsWith('/slider/create')) {
    target = `/admin/slider/create?error=${encodeURIComponent(message)}`;
  } else {
    const m = p.match(/^\/slider\/([^/]+)\/edit$/);
    if (m) {
      target = `/admin/slider/${m[1]}/edit?error=${encodeURIComponent(message)}`;
    }
  }
  res.redirect(target);
}

async function unlinkWithRetry(filePath: string, attempts = 8): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    try {
      await fs.promises.unlink(filePath);
      return;
    } catch (e: unknown) {
      const err = e as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        return;
      }
      if ((err.code === 'EPERM' || err.code === 'EBUSY') && i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 40 * (i + 1)));
        continue;
      }
      throw e;
    }
  }
}

type SharpFn = typeof import('sharp');

async function loadSharp(): Promise<SharpFn | null> {
  try {
    const m = (await import('sharp')) as { default: SharpFn };
    return m.default;
  } catch {
    return null;
  }
}

/** EXIF orientation 1–8; mirrors sharp’s auto-orient behaviour (approximate for rare 5/7). */
function applyExifOrientation(
  image: {
    rotate: (deg: number) => unknown;
    flip: (opts: { horizontal?: boolean; vertical?: boolean }) => unknown;
  },
  o: number | undefined
): void {
  if (!o || o < 2 || o > 8) return;
  switch (o) {
    case 2:
      image.flip({ horizontal: true });
      break;
    case 3:
      image.rotate(180);
      break;
    case 4:
      image.flip({ vertical: true });
      break;
    case 5:
      image.rotate(90);
      image.flip({ horizontal: true });
      break;
    case 6:
      image.rotate(90);
      break;
    case 7:
      image.rotate(-90);
      image.flip({ horizontal: true });
      break;
    case 8:
      image.rotate(-90);
      break;
    default:
      break;
  }
}

async function processWithSharp(sharp: SharpFn, file: Express.Multer.File, input: Buffer): Promise<void> {
  const dir = path.dirname(file.path);
  const ext = path.extname(file.filename);
  const base = path.basename(file.filename, ext);
  const maxW = getSliderImageMaxWidth();
  const quality = getSliderWebpQuality();

  const meta = await sharp(input).metadata();

  let pipeline = sharp(input).rotate();
  if (meta.width && meta.width > maxW) {
    pipeline = pipeline.resize({
      width: maxW,
      withoutEnlargement: true
    });
  }

  const finalPath = path.join(dir, `${base}.webp`);
  const tempPath = path.join(dir, `.opt-${base}-${Date.now()}.tmp`);

  try {
    await pipeline
      .webp({
        quality,
        alphaQuality: Math.min(100, quality + 8),
        effort: 5
      })
      .toFile(tempPath);

    await unlinkWithRetry(file.path);
    if (finalPath !== file.path) {
      await unlinkWithRetry(finalPath);
    }
    await fs.promises.rename(tempPath, finalPath);

    const stat = await fs.promises.stat(finalPath);
    file.filename = path.basename(finalPath);
    file.path = finalPath;
    file.size = stat.size;
    file.mimetype = 'image/webp';
  } catch (e) {
    try {
      await fs.promises.unlink(tempPath);
    } catch {
      /* ignore */
    }
    throw e;
  }
}

/**
 * Fallback when native sharp cannot load (e.g. linux-x64 CPUs below x86-64-v2).
 * Uses Jimp + WASM WebP encoder — slower but CPU-agnostic.
 */
async function processWithJimpWasmWebp(
  file: Express.Multer.File,
  input: Buffer,
  maxW: number,
  quality: number
): Promise<void> {
  const { Jimp } = await import('jimp');
  const exifr = (await import('exifr')).default;
  const { default: encodeWebp } = await loadJsquashWebpEncode();

  const dir = path.dirname(file.path);
  const ext = path.extname(file.filename);
  const base = path.basename(file.filename, ext);
  const finalPath = path.join(dir, `${base}.webp`);
  const tempPath = path.join(dir, `.opt-${base}-${Date.now()}.tmp`);

  let image = await Jimp.read(input);

  let orient: number | undefined;
  try {
    orient = await exifr.orientation(input);
  } catch {
    orient = undefined;
  }
  applyExifOrientation(image, orient);

  if (image.width > maxW) {
    const nh = Math.round(image.height * (maxW / image.width));
    image.resize({ w: maxW, h: nh });
  }

  const { data, width, height } = image.bitmap;
  const rgba =
    data instanceof Uint8ClampedArray
      ? data
      : new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength);

  const imageData = {
    data: rgba,
    width,
    height
  } as ImageData;

  try {
    const out = await encodeWebp(imageData, {
      quality,
      alpha_quality: Math.min(100, quality + 8)
    });
    const buf = Buffer.from(out);

    await fs.promises.writeFile(tempPath, buf);
    await unlinkWithRetry(file.path);
    if (finalPath !== file.path) {
      await unlinkWithRetry(finalPath);
    }
    await fs.promises.rename(tempPath, finalPath);

    const stat = await fs.promises.stat(finalPath);
    file.filename = path.basename(finalPath);
    file.path = finalPath;
    file.size = stat.size;
    file.mimetype = 'image/webp';
  } catch (e) {
    try {
      await fs.promises.unlink(tempPath);
    } catch {
      /* ignore */
    }
    throw e;
  }
}

/**
 * Resize (max width), auto-orient, encode as WebP, then delete the original upload (only the .webp remains).
 * Reads the upload into memory first so Sharp does not keep the path open (avoids Windows EPERM on unlink).
 * Uses sharp when available; on older Linux CPUs without x86-64-v2, falls back to Jimp + WASM WebP.
 */
export async function processUploadedSliderImage(file: Express.Multer.File): Promise<void> {
  const input = await fs.promises.readFile(file.path);
  const sharpFn = await loadSharp();
  if (sharpFn) {
    await processWithSharp(sharpFn, file, input);
    return;
  }
  await processWithJimpWasmWebp(file, input, getSliderImageMaxWidth(), getSliderWebpQuality());
}
