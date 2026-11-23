import * as fs from 'fs';
import * as path from 'path';
import { getProductImagePublicUrl } from '../constants/data-paths';
import {
  publicUrlToAbsolutePath,
  thumbPublicUrlFromSourcePublicUrl,
  resolveListingThumbUrl,
} from './imageThumbService';

function normalizePublicUrl(url: string): string {
  let s = url.trim().replace(/\\/g, '/');
  if (!s) return '';
  if (!s.startsWith('/')) s = '/' + s;
  return s.replace(/\/+/g, '/');
}

export function isProductFolderImageUrl(productId: number, imageUrl: string): boolean {
  const prefix = `/images/products/${productId}/`;
  return normalizePublicUrl(imageUrl).startsWith(prefix);
}

/**
 * Prefer per-product folder URL when the file exists on disk; otherwise keep stored URL
 * (backward compatibility with legacy flat /images/product-* paths).
 */
export function resolveProductImageUrl(
  productId: number,
  storedUrl: string | null | undefined
): string | null {
  if (!storedUrl?.trim()) return null;

  const url = normalizePublicUrl(storedUrl);
  if (isProductFolderImageUrl(productId, url)) return url;

  const basename = path.posix.basename(url);
  if (!basename) return url;

  const candidate = getProductImagePublicUrl(productId, basename);
  const absCandidate = publicUrlToAbsolutePath(candidate);
  if (absCandidate && fs.existsSync(absCandidate)) return candidate;

  const absStored = publicUrlToAbsolutePath(url);
  if (absStored && fs.existsSync(absStored)) return url;

  return candidate;
}

/**
 * Resolve thumb URL for a product image, preferring per-product thumbs/ subfolder.
 */
export function resolveProductThumbUrl(
  productId: number,
  imageUrl: string | null | undefined,
  storedThumbUrl: string | null | undefined
): string | null {
  const resolvedImage = imageUrl ? resolveProductImageUrl(productId, imageUrl) : null;
  if (!resolvedImage) {
    if (!storedThumbUrl) return null;
    return resolveProductImageUrl(productId, storedThumbUrl);
  }

  return resolveListingThumbUrl(resolvedImage, storedThumbUrl);
}

export function normalizeProductImageRow<T extends { image_url?: string | null; thumb_url?: string | null }>(
  productId: number,
  row: T
): T {
  const image_url = resolveProductImageUrl(productId, row.image_url ?? null);
  const thumb_url = resolveProductThumbUrl(productId, image_url, row.thumb_url ?? null);
  return { ...row, image_url, thumb_url };
}

export function normalizeProductImages<T extends { image_url?: string | null; thumb_url?: string | null }>(
  productId: number,
  rows: T[]
): T[] {
  return rows.map(row => normalizeProductImageRow(productId, row));
}

/**
 * Target public URLs when copying/migrating a legacy image into a product folder.
 */
export function migratedProductImageUrls(
  productId: number,
  sourceImageUrl: string
): { image_url: string; thumb_url: string } {
  const basename = path.posix.basename(normalizePublicUrl(sourceImageUrl));
  const image_url = getProductImagePublicUrl(productId, basename);
  const thumb_url = thumbPublicUrlFromSourcePublicUrl(image_url);
  return { image_url, thumb_url };
}
