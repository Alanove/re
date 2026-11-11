import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { DATA_PATHS } from '../constants/data-paths';

/** 3:4 portrait listing thumb — scale both dimensions together if higher-res is needed. */
export const THUMB_WIDTH = 900;
export const THUMB_HEIGHT = 1200;
const WEBP_QUALITY = 82;
const THUMB_ASPECT = THUMB_WIDTH / THUMB_HEIGHT;
/** Fallback when blurred fill composite fails. */
const THUMB_PAD_FALLBACK_BG = { r: 255, g: 255, b: 255, alpha: 1 as const };
const THUMB_BLUR_SIGMA = 28;

export type ThumbCropMode = 'pad' | 'cover-centre' | 'cover-attention';

/**
 * Tall portrait on-model shots are narrower than 3:4 — cover crop trims head/feet.
 * Fill side gaps with a blurred cover of the same image; white only as fallback.
 * Wider sources use horizontal cover + attention.
 */
export function resolveThumbCropMode(sourceWidth: number, sourceHeight: number): ThumbCropMode {
  if (sourceWidth <= 0 || sourceHeight <= 0) return 'cover-centre';
  const sourceAspect = sourceWidth / sourceHeight;
  if (sourceAspect < THUMB_ASPECT - 0.02) return 'pad';
  if (sourceAspect > THUMB_ASPECT + 0.02) return 'cover-attention';
  return 'cover-centre';
}

async function writePaddedListingThumb(rotated: sharp.Sharp, thumbAbs: string): Promise<void> {
  const { data, info } = await rotated
    .clone()
    .resize(THUMB_WIDTH, THUMB_HEIGHT, { fit: 'inside' })
    .toBuffer({ resolveWithObject: true });

  const padLeft = Math.floor((THUMB_WIDTH - info.width) / 2);
  const padTop = Math.floor((THUMB_HEIGHT - info.height) / 2);

  if (info.width === THUMB_WIDTH && info.height === THUMB_HEIGHT) {
    await sharp(data).webp({ quality: WEBP_QUALITY }).toFile(thumbAbs);
    return;
  }

  try {
    const background = await rotated
      .clone()
      .resize(THUMB_WIDTH, THUMB_HEIGHT, { fit: 'cover', position: 'centre' })
      .blur(THUMB_BLUR_SIGMA)
      .toBuffer();

    await sharp(background)
      .composite([{ input: data, left: padLeft, top: padTop }])
      .webp({ quality: WEBP_QUALITY })
      .toFile(thumbAbs);
  } catch {
    const padRight = THUMB_WIDTH - info.width - padLeft;
    const padBottom = THUMB_HEIGHT - info.height - padTop;
    await sharp(data)
      .extend({
        top: padTop,
        bottom: padBottom,
        left: padLeft,
        right: padRight,
        background: THUMB_PAD_FALLBACK_BG,
      })
      .webp({ quality: WEBP_QUALITY })
      .toFile(thumbAbs);
  }
}

async function writeListingThumb(rotated: sharp.Sharp, thumbAbs: string, mode: ThumbCropMode): Promise<void> {
  if (mode === 'pad') {
    await writePaddedListingThumb(rotated, thumbAbs);
    return;
  }

  const position = mode === 'cover-attention' ? 'attention' : 'centre';
  await rotated
    .resize(THUMB_WIDTH, THUMB_HEIGHT, { fit: 'cover', position })
    .webp({ quality: WEBP_QUALITY })
    .toFile(thumbAbs);
}

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
 * Generate a 3:4 WebP listing thumb under a `thumbs` subfolder.
 * Returns public thumb URL or null.
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
    const rotated = sharp(absSource).rotate();
    const meta = await rotated.metadata();
    const mode = resolveThumbCropMode(meta.width ?? 0, meta.height ?? 0);
    await writeListingThumb(rotated, thumbAbs, mode);
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
