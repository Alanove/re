/**
 * True when the product has a non-zero price to show (base, variant range, or any variant).
 */
export function productHasDisplayPrice(product: {
  price?: number | string | null;
  has_multi_prices?: boolean | number;
  variant_price_min?: number | string | null;
  variant_price_max?: number | string | null;
  variants?: Array<{ price?: number | string | null }>;
}): boolean {
  const base = parseFloat(String(product?.price ?? ''));
  if (Number.isFinite(base) && base > 0) return true;

  const hasMulti =
    product?.has_multi_prices === true ||
    product?.has_multi_prices === 1 ||
    String(product?.has_multi_prices) === '1';

  if (hasMulti) {
    const min = Number(product?.variant_price_min);
    const max = Number(product?.variant_price_max);
    if (Number.isFinite(min) && min > 0) return true;
    if (Number.isFinite(max) && max > 0) return true;
  }

  for (const v of product?.variants || []) {
    const vp = parseFloat(String(v?.price ?? ''));
    if (Number.isFinite(vp) && vp > 0) return true;
  }

  return false;
}
