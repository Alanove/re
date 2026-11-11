/** Resolve Open Graph image URL from product.images (listing or PDP shape). */
export function ogImageUrlFromProduct(
  product: {
    images?: Array<{ image_url?: string | null; thumb_url?: string | null; is_primary?: boolean | number }>;
  } | null | undefined
): string {
  const imgs = product?.images;
  if (!imgs || imgs.length === 0) return '';
  const sorted = [...imgs].sort((a, b) => {
    const ap = a.is_primary === true || a.is_primary === 1 ? 1 : 0;
    const bp = b.is_primary === true || b.is_primary === 1 ? 1 : 0;
    return bp - ap;
  });
  for (const img of sorted) {
    const u = String(img.image_url || img.thumb_url || '').trim();
    if (u) return u;
  }
  return '';
}

export function ogImageUrlFromProductList(products: any[] | null | undefined): string {
  if (!products?.length) return '';
  for (const p of products) {
    const u = ogImageUrlFromProduct(p);
    if (u) return u;
  }
  return '';
}
