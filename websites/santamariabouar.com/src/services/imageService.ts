import fs from 'fs';
import path from 'path';
import { getSharp } from './sharpLoader';

/** Max width for uploaded apartment photos (Full HD). */
export const APARTMENT_PHOTO_MAX_WIDTH = 1920;

/** Max file size per apartment photo upload (30 MB). */
export const APARTMENT_PHOTO_MAX_FILE_SIZE = 30 * 1024 * 1024;

/**
 * Resize an image in place if it exceeds the max width, preserving aspect ratio.
 * Returns true if resize succeeded or was unnecessary; false if sharp is unavailable or resize failed.
 */
export async function resizeImageToMaxWidth(
  filePath: string,
  maxWidth: number = APARTMENT_PHOTO_MAX_WIDTH
): Promise<boolean> {
  const sharp = getSharp();
  if (!sharp) {
    return false;
  }

  try {
    const image = sharp(filePath);
    const metadata = await image.metadata();
    if (!metadata.width || metadata.width <= maxWidth) {
      return true;
    }

    const ext = path.extname(filePath).toLowerCase();
    const tempPath = `${filePath}.tmp`;
    let pipeline = image.resize({ width: maxWidth, withoutEnlargement: true });

    if (ext === '.png') {
      pipeline = pipeline.png({ compressionLevel: 8 });
    } else if (ext === '.webp') {
      pipeline = pipeline.webp({ quality: 85 });
    } else {
      pipeline = pipeline.jpeg({ quality: 85, mozjpeg: true });
    }

    await pipeline.toFile(tempPath);
    fs.renameSync(tempPath, filePath);
    return true;
  } catch (error) {
    console.error('Error resizing image:', filePath, error);
    if (fs.existsSync(`${filePath}.tmp`)) {
      fs.unlinkSync(`${filePath}.tmp`);
    }
    return false;
  }
}
