/**
 * View helpers for EJS templates (e.g. formatting text for display).
 */

import { resolveListingThumbUrl } from '../services/imageThumbService';

const REG_SUP = '<sup class="tm-sup">&reg;</sup>';

/**
 * Replaces all variations of the registered trademark symbol (®) with
 * <sup>&reg;</sup> for proper typography in HTML.
 * Handles: ® (Unicode), &reg;, &#174;, &#x00AE;, etc.
 */
export function formatTrademarks(text: string): string {
  if (typeof text !== 'string' || !text) return text;
  return text
    .replace(/&reg;/gi, REG_SUP)
    .replace(/&#174;/g, REG_SUP)
    .replace(/&#x00AE;/gi, REG_SUP)
    .replace(/\u00AE/g, REG_SUP)
    .replace(/®/g, REG_SUP);
}

/**
 * Public category cards / mega menu: prefer WebP thumb on disk or DB thumb_url; else full image_url.
 */
/**
 * Storefront money display: whole dollars without ".00" (e.g. 10 not 10.00; 9.98 stays 9.98).
 */
export function formatMoneyAmount(value: number | string | null | undefined): string {
  const num = parseFloat(String(value ?? ''));
  if (!Number.isFinite(num)) return '0';
  const s = num.toFixed(2);
  if (s.endsWith('.00')) return s.slice(0, -3);
  return s;
}

export function categoryListingImageUrl(category: {
  image_url?: string | null;
  thumb_url?: string | null;
}): string {
  const src = category?.image_url?.trim();
  if (!src) return '/images/no-image.jpg';
  const resolved = resolveListingThumbUrl(src, category?.thumb_url);
  return resolved || src;
}
