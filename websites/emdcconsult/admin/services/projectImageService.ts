import * as fs from 'fs';
import * as path from 'path';

const RASTER_EXT = /\.(jpe?g|png|gif|webp|bmp|tif{1,2}|heic|heif|avif)$/i;
const DISPLAY_MAX_WIDTH = 1600;
const THUMB_MAX_WIDTH = 800;
const WEBP_QUALITY = 82;
const THUMB_QUALITY = 78;

type SharpFn = typeof import('sharp');

let sharpPromise: Promise<SharpFn | null> | null = null;

async function loadSharp(): Promise<SharpFn | null> {
  if (!sharpPromise) {
    sharpPromise = (async () => {
      try {
        const m = (await import('sharp')) as { default: SharpFn };
        return m.default;
      } catch (error) {
        console.error('Failed to load sharp for project images:', error);
        return null;
      }
    })();
  }
  return sharpPromise;
}

export function isRasterProjectImage(filename: string): boolean {
  return RASTER_EXT.test(path.extname(filename || ''));
}

export function projectThumbFilename(imageName: string): string {
  const base = path.basename(imageName, path.extname(imageName));
  if (base.endsWith('-thumb')) {
    return `${base}.webp`;
  }
  return `${base}-thumb.webp`;
}

export function getProjectThumbUrl(imageUrl: string | undefined): string {
  if (!imageUrl || typeof imageUrl !== 'string') {
    return '';
  }
  const cleaned = imageUrl.trim().replace(/\\/g, '/');
  if (!cleaned || cleaned.includes('..')) {
    return cleaned;
  }
  const dir = path.posix.dirname(cleaned);
  const file = path.posix.basename(cleaned);
  if (!file || file === '.' || file === '..') {
    return cleaned;
  }
  const thumb = projectThumbFilename(file);
  return dir === '/' ? `/${thumb}` : `${dir}/${thumb}`;
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

async function writeWebpVariant(
  sharp: SharpFn,
  input: Buffer,
  destPath: string,
  maxWidth: number,
  quality: number
): Promise<void> {
  const tempPath = `${destPath}.${Date.now()}.tmp`;
  try {
    await sharp(input)
      .rotate()
      .resize({
        width: maxWidth,
        withoutEnlargement: true
      })
      .webp({
        quality,
        alphaQuality: Math.min(100, quality + 8),
        effort: 4
      })
      .toFile(tempPath);

    await unlinkWithRetry(destPath);
    await fs.promises.rename(tempPath, destPath);
  } catch (error) {
    try {
      await fs.promises.unlink(tempPath);
    } catch {
      /* ignore */
    }
    throw error;
  }
}

export interface ProcessedProjectImage {
  filename: string;
  thumbFilename: string;
  path: string;
  thumbPath: string;
}

/**
 * Convert a project/work raster into a display WebP (max 1600px) and a -thumb.webp (max 800px).
 * Deletes the original only after both files are written. SVG files are left alone.
 */
export async function processProjectImageFile(absolutePath: string): Promise<ProcessedProjectImage | null> {
  const filename = path.basename(absolutePath);
  const ext = path.extname(filename);
  if (!isRasterProjectImage(filename) || ext.toLowerCase() === '.svg') {
    return null;
  }

  const sharp = await loadSharp();
  if (!sharp) {
    throw new Error('sharp is not available for project image processing');
  }

  const dir = path.dirname(absolutePath);
  const base = path.basename(filename, ext);
  const displayName = `${base.replace(/-thumb$/i, '')}.webp`;
  const thumbName = projectThumbFilename(displayName);
  const displayPath = path.join(dir, displayName);
  const thumbPath = path.join(dir, thumbName);

  const input = await fs.promises.readFile(absolutePath);
  const alreadyWebp = ext.toLowerCase() === '.webp' && path.resolve(absolutePath) === path.resolve(displayPath);

  if (!alreadyWebp) {
    await writeWebpVariant(sharp, input, displayPath, DISPLAY_MAX_WIDTH, WEBP_QUALITY);
  } else if (!fs.existsSync(displayPath)) {
    await writeWebpVariant(sharp, input, displayPath, DISPLAY_MAX_WIDTH, WEBP_QUALITY);
  }

  const displayBuffer = alreadyWebp && fs.existsSync(displayPath)
    ? await fs.promises.readFile(displayPath)
    : await fs.promises.readFile(displayPath);

  await writeWebpVariant(sharp, displayBuffer, thumbPath, THUMB_MAX_WIDTH, THUMB_QUALITY);

  if (path.resolve(absolutePath) !== path.resolve(displayPath) && path.resolve(absolutePath) !== path.resolve(thumbPath)) {
    await unlinkWithRetry(absolutePath);
  }

  return {
    filename: displayName,
    thumbFilename: thumbName,
    path: displayPath,
    thumbPath
  };
}

/**
 * Process a multer upload that has already been moved into its project/work folder.
 * Updates the multer file metadata to the WebP display name.
 */
export async function processUploadedProjectImage(file: Express.Multer.File): Promise<string> {
  const processed = await processProjectImageFile(file.path);
  if (!processed) {
    return path.basename(file.filename);
  }
  file.filename = processed.filename;
  file.path = processed.path;
  file.mimetype = 'image/webp';
  try {
    file.size = (await fs.promises.stat(processed.path)).size;
  } catch {
    /* keep previous size */
  }
  return processed.filename;
}

export function deleteProjectImageVariants(directory: string, imageName: string | undefined): void {
  if (!imageName || imageName.includes('/') || imageName.includes('\\') || imageName.includes('..')) {
    return;
  }
  const baseName = path.basename(imageName);
  const targets = [
    path.join(directory, baseName),
    path.join(directory, projectThumbFilename(baseName))
  ];
  for (const target of targets) {
    if (fs.existsSync(target)) {
      try {
        fs.unlinkSync(target);
      } catch (error) {
        console.error('Failed to delete project image variant:', target, error);
      }
    }
  }
}
