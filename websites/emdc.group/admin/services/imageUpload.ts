import path from 'path';

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp|tif{1,2}|heic|heif|avif|ico)$/i;

/** Phone photos are often larger than 5MB and some browsers send them as application/octet-stream. */
export const IMAGE_UPLOAD_MAX_BYTES = 50 * 1024 * 1024;

export function isAllowedImageUpload(file: { mimetype?: string; originalname?: string }): boolean {
  const mime = file.mimetype || '';
  if (mime.startsWith('image/')) {
    return true;
  }
  return IMAGE_EXT.test(path.extname(file.originalname || ''));
}

/** A new file always gets a new name so a replacement is not hidden by the previous URL or a locked file. */
export function uniqueImageFilename(prefix: string, originalname: string): string {
  const ext = (path.extname(originalname || '') || '.img').toLowerCase();
  const safePrefix = prefix.replace(/[^a-z0-9_-]/gi, '') || 'image';
  return `${safePrefix}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
}
