import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { DATA_PATHS } from '../constants/data-paths';

const MAX_WIDTH = 480;
const MAX_HEIGHT = 480;
const WEBP_QUALITY = 82;

/**
 * Public site URL path (e.g. /images/foo.jpg) → absolute path under public/.
 */
export function publicUrlToAbsolutePath(publicUrl: string): string | null {
  if (!publicUrl || typeof publicUrl !== 'string') return null;
  let u = publicUrl.trim();
  if (!u) return null;
  if (/^https?:\/\//i.test(u) || u.startsWith('//')) return null;
  u = u.replace(/\\/g, '/').replace(/^\/+/, '/');
  if (!u.startsWith('/')) u = '/' + u;
  return path.join(DATA_PATHS.PUBLIC_DIR, u.replace(/^\//, ''));
}

/**
 * Given a source image public URL, return the canonical thumb public URL (WebP under .../thumbs/).
 */
export function thumbPublicUrlFromSourcePublicUrl(imagePublicUrl: string): string {
  let u = imagePublicUrl.trim().replace(/\\/g, '/');
  if (!u.startsWith('/')) u = '/' + u;
  const dirname = path.posix.dirname(u);
  const base = path.posix.basename(u);
  const ext = path.posix.extname(base);
  const nameWithout = ext ? base.slice(0, -ext.length) : base;
  const thumbName = `${nameWithout}.webp`;
  if (dirname === '/' || dirname === '.') {
    return `/thumbs/${thumbName}`;
  }
  return `${dirname}/thumbs/${thumbName}`;
}

function absolutePathToPublicRelative(absFilePath: string): string | null {
  const norm = path.normalize(absFilePath);
  const pub = path.normalize(DATA_PATHS.PUBLIC_DIR);
  if (!norm.toLowerCase().startsWith(pub.toLowerCase())) return null;
  return path.relative(pub, norm).replace(/\\/g, '/');
}

/**
 * Generate WebP thumb next to originals under a `thumbs` subfolder. Returns public thumb URL or null.
 */
export async function generateThumbForPublicUrl(imagePublicUrl: string): Promise<string | null> {
  const absSource = publicUrlToAbsolutePath(imagePublicUrl);
  if (!absSource || !fs.existsSync(absSource)) return null;

  const rel = absolutePathToPublicRelative(absSource);
  if (!rel) return null;

  const lower = absSource.toLowerCase();
  if (lower.endsWith('.svg')) return null;

  const posixDir = path.posix.dirname(rel.replace(/\\/g, '/'));
  const baseName = path.basename(absSource, path.extname(absSource));
  const thumbDirAbs = path.join(DATA_PATHS.PUBLIC_DIR, posixDir, 'thumbs');
  if (!fs.existsSync(thumbDirAbs)) {
    fs.mkdirSync(thumbDirAbs, { recursive: true });
  }
  const thumbAbs = path.join(thumbDirAbs, `${baseName}.webp`);

  try {
    await sharp(absSource)
      .resize(MAX_WIDTH, MAX_HEIGHT, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toFile(thumbAbs);
  } catch (e) {
    console.error('imageThumbService: sharp failed for', absSource, e);
    return null;
  }

  return thumbPublicUrlFromSourcePublicUrl('/' + rel.replace(/\\/g, '/'));
}

export function deleteThumbFileForSourceImageUrl(imagePublicUrl: string | null | undefined): void {
  if (!imagePublicUrl) return;
  const thumbUrl = thumbPublicUrlFromSourcePublicUrl(imagePublicUrl);
  deleteThumbFileByThumbUrl(thumbUrl);
}

export function deleteThumbFileByThumbUrl(thumbPublicUrl: string | null | undefined): void {
  if (!thumbPublicUrl) return;
  const abs = publicUrlToAbsolutePath(thumbPublicUrl);
  if (abs && fs.existsSync(abs)) {
    try {
      fs.unlinkSync(abs);
    } catch {
      /* ignore */
    }
  }
}

/**
 * For listing UIs: prefer DB thumb_url if the file exists; else use conventional .../thumbs/*.webp if present.
 * Returns null if no thumb file exists (caller falls back to full image_url).
 */
export function resolveListingThumbUrl(
  imagePublicUrl: string,
  dbThumbUrl: string | null | undefined
): string | null {
  const norm = (u: string) => {
    let s = u.trim().replace(/\\/g, '/');
    if (!s) return '';
    if (!s.startsWith('/')) s = '/' + s;
    return s.replace(/\/+/g, '/');
  };

  if (dbThumbUrl) {
    const u = norm(dbThumbUrl);
    if (u) {
      const abs = publicUrlToAbsolutePath(u);
      if (abs && fs.existsSync(abs)) return u;
    }
  }

  const src = norm(imagePublicUrl || '');
  if (!src) return null;
  const candidate = thumbPublicUrlFromSourcePublicUrl(src);
  const absCandidate = publicUrlToAbsolutePath(candidate);
  if (absCandidate && fs.existsSync(absCandidate)) return candidate;
  return null;
}
