import type {
  ProductAttribute,
  ProductAttributeValue
} from '../../admin/services/productAttributeService';
import { resolveListingThumbUrl } from './imageThumbService';

export interface VariantDisplayOption {
  value: string;
  variant_id: number | null;
  value_id: number | null;
  color_code: string | null;
  image_url: string | null;
  resolved_image_url: string | null;
  /** DB or CMS thumb for this value (product_images or variant_type_values) */
  thumb_url?: string | null;
}

export interface VariantDisplayGroup {
  /** Label shown to the user (from variant_types / CMS) */
  displayName: string;
  /** Key used in product_variants.attributes JSON — must match for cart matching */
  storageKey: string;
  display_order: number;
  options: VariantDisplayOption[];
}

export interface VariantDisplayModel {
  groups: VariantDisplayGroup[];
}

function normalizeVal(s: string | undefined | null): string {
  return String(s || '')
    .trim()
    .toLowerCase();
}

function normalizeMediaUrl(url: string | undefined | null): string {
  if (!url || typeof url !== 'string') return '';
  let u = url.trim();
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  if (u.indexOf('//') === 0) return u;
  u = u.replace(/\\/g, '/');
  if (u.indexOf('/') !== 0) u = '/' + u;
  return u;
}

function parseAttributes(variant: any): Record<string, string> {
  if (!variant || variant.attributes == null) return {};
  let attrs = variant.attributes;
  if (typeof attrs === 'string') {
    try {
      attrs = JSON.parse(attrs);
    } catch {
      return {};
    }
  }
  if (typeof attrs !== 'object' || attrs === null) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(attrs)) {
    if (v != null && v !== '') out[k] = String(v);
  }
  return out;
}

/** Merge variant JSON keys that differ only by case/spelling into one bucket per normalized key */
function buildBucketsFromVariants(variants: any[]): Map<
  string,
  { storageKey: string; options: Array<{ value: string; variant_id: number }> }
> {
  const byNormKey = new Map<
    string,
    { storageKey: string; options: Array<{ value: string; variant_id: number }> }
  >();

  for (const v of variants) {
    const attrs = parseAttributes(v);
    const vid = Number(v.id);
    for (const [key, value] of Object.entries(attrs)) {
      const nk = normalizeVal(key);
      if (!byNormKey.has(nk)) {
        byNormKey.set(nk, { storageKey: key, options: [] });
      }
      const bucket = byNormKey.get(nk)!;
      const nv = normalizeVal(value);
      if (!bucket.options.some(o => normalizeVal(o.value) === nv)) {
        bucket.options.push({ value, variant_id: vid });
      }
    }
  }
  return byNormKey;
}

function resolveStorageKeyFromDisplayName(displayName: string, variants: any[]): string {
  const want = normalizeVal(displayName);
  if (!variants.length) return displayName;
  const first = parseAttributes(variants[0]);
  for (const k of Object.keys(first)) {
    if (normalizeVal(k) === want) return k;
  }
  return displayName;
}

function variantOptionsForNormKey(
  byNormKey: Map<string, { storageKey: string; options: Array<{ value: string; variant_id: number }> }>,
  attrKey: string
): Array<{ value: string; variant_id: number }> {
  const want = normalizeVal(attrKey);
  for (const [nk, bucket] of byNormKey) {
    if (nk === want) return bucket.options;
  }
  return [];
}

function getBucketStorageKey(
  byNormKey: Map<string, { storageKey: string; options: Array<{ value: string; variant_id: number }> }>,
  attrKey: string
): string | null {
  const want = normalizeVal(attrKey);
  for (const [nk, bucket] of byNormKey) {
    if (nk === want) return bucket.storageKey;
  }
  return null;
}

function mergeAttrKeySetFixed(
  variantsParam: any[],
  byNormKey: Map<string, { storageKey: string; options: Array<{ value: string; variant_id: number }> }>,
  productAttributes: ProductAttribute[]
): string[] {
  const paByNorm = new Map<string, string>();
  for (const pa of productAttributes) {
    if (pa.name) paByNorm.set(normalizeVal(pa.name), pa.name);
  }

  const ordered: string[] = [];
  const seen = new Set<string>();

  const add = (displayName: string) => {
    const n = normalizeVal(displayName);
    if (seen.has(n)) return;
    seen.add(n);
    ordered.push(displayName);
  };

  const sortedPa = [...productAttributes].sort(
    (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)
  );
  for (const pa of sortedPa) {
    if (pa.name) add(pa.name);
  }

  if (variantsParam.length) {
    const fa = parseAttributes(variantsParam[0]);
    for (const k of Object.keys(fa)) {
      const canonical = paByNorm.get(normalizeVal(k)) || k;
      add(canonical);
    }
  }

  for (const nk of byNormKey.keys()) {
    const bucket = byNormKey.get(nk)!;
    const canonical = paByNorm.get(nk) || bucket.storageKey;
    add(canonical);
  }

  return ordered;
}

function findPaByName(productAttributes: ProductAttribute[], attrKey: string): ProductAttribute | undefined {
  const want = normalizeVal(attrKey);
  return productAttributes.find(pa => normalizeVal(pa.name) === want);
}

function filterPaValues(attr: ProductAttribute): ProductAttributeValue[] {
  if (!attr.values || attr.values.length === 0) return [];
  const sel = attr.selected_values || [];
  if (sel.length > 0) {
    return attr.values.filter(v => sel.indexOf(v.id) >= 0);
  }
  return attr.values;
}

function buildValueDetailsMap(
  productImages:
    | Array<{
        attribute_value_id?: number | null;
        image_url?: string;
        thumb_url?: string | null;
        /** Raw product_images.thumb_url before listing resolution */
        thumb_url_db?: string | null;
      }>
    | undefined,
  productAttributes: ProductAttribute[]
): Map<
  string,
  {
    id: number;
    color_code: string | null;
    image_url: string | null;
    resolved_image_url: string;
    thumb_url: string | null;
  }
> {
  const map = new Map<
    string,
    {
      id: number;
      color_code: string | null;
      image_url: string | null;
      resolved_image_url: string;
      thumb_url: string | null;
    }
  >();

  for (const attr of productAttributes) {
    const attrName = attr.name || '';
    if (!attr.values) continue;
    for (const val of attr.values) {
      if (!val.value) continue;
      const valAny = val as ProductAttributeValue & { image_url?: string | null; thumb_url?: string | null };
      const key = `${normalizeVal(attrName)}:${normalizeVal(val.value)}`;
      let resolved = '';
      let thumbFromPi: string | null = null;
      if (productImages && val.id) {
        const row = productImages.find(
          im => im.attribute_value_id != null && Number(im.attribute_value_id) === Number(val.id)
        );
        if (row?.image_url) resolved = normalizeMediaUrl(row.image_url);
        if (row) {
          const rawDb = row.thumb_url_db ?? null;
          if (row.thumb_url) {
            const t = normalizeMediaUrl(row.thumb_url);
            thumbFromPi = t || null;
          }
          if (!thumbFromPi && row.image_url) {
            thumbFromPi = resolveListingThumbUrl(
              normalizeMediaUrl(row.image_url),
              rawDb ?? undefined
            );
          }
        }
      }
      if (!resolved && valAny.image_url) resolved = normalizeMediaUrl(valAny.image_url);
      const thumbFromVal = valAny.thumb_url ? normalizeMediaUrl(valAny.thumb_url) || null : null;
      const thumbCombined = thumbFromPi || thumbFromVal || null;
      map.set(key, {
        id: val.id,
        color_code: val.color_code,
        image_url: valAny.image_url ?? null,
        resolved_image_url: resolved,
        thumb_url: thumbCombined
      });
    }
  }
  return map;
}

function getDetailsForOption(
  valueDetailsMap: Map<
    string,
    {
      id: number;
      color_code: string | null;
      image_url: string | null;
      resolved_image_url: string;
      thumb_url: string | null;
    }
  >,
  attrKey: string,
  optionValue: string
): {
  id: number | null;
  color_code: string | null;
  image_url: string | null;
  resolved_image_url: string;
  thumb_url: string | null;
} {
  const k = `${normalizeVal(attrKey)}:${normalizeVal(optionValue)}`;
  const direct = valueDetailsMap.get(k);
  if (direct) return { ...direct, id: direct.id };
  const nv = normalizeVal(optionValue);
  const wantAttr = normalizeVal(attrKey);
  for (const [key, det] of valueDetailsMap) {
    const colon = key.indexOf(':');
    if (colon < 0) continue;
    const attrPart = key.slice(0, colon);
    const valPart = key.slice(colon + 1);
    if (normalizeVal(attrPart) === wantAttr && valPart === nv) {
      return { ...det, id: det.id };
    }
  }
  return { id: null, color_code: null, image_url: null, resolved_image_url: '', thumb_url: null };
}

/**
 * Build canonical variant groups for PDP, API, and quick-add drawer (same rules everywhere).
 */
export function buildVariantDisplayModel(
  product: {
    images?: Array<{
      attribute_value_id?: number | null;
      image_url?: string;
      thumb_url?: string | null;
      thumb_url_db?: string | null;
    }>;
  },
  variants: any[],
  productAttributes: ProductAttribute[]
): VariantDisplayModel {
  if (!variants || variants.length === 0) {
    return { groups: [] };
  }

  const byNormKey = buildBucketsFromVariants(variants);
  const attrKeys = mergeAttrKeySetFixed(variants, byNormKey, productAttributes);
  const valueDetailsMap = buildValueDetailsMap(product.images, productAttributes);

  const groups: VariantDisplayGroup[] = [];

  for (const attrKey of attrKeys) {
    const pa = findPaByName(productAttributes, attrKey);
    const displayName = pa?.name || attrKey;
    const displayOrder = pa?.display_order ?? 999;
    const storageKey =
      getBucketStorageKey(byNormKey, attrKey) || resolveStorageKeyFromDisplayName(displayName, variants);

    const fromV = variantOptionsForNormKey(byNormKey, attrKey);
    const fromPa = pa ? filterPaValues(pa) : [];

    const seen = new Set<string>();
    const merged: VariantDisplayOption[] = [];

    const addOpt = (value: string, variantId: number | null, force = false) => {
      const nv = normalizeVal(value);
      if (!nv) return;
      if (seen.has(nv) && !force) return;
      seen.add(nv);
      const det = getDetailsForOption(valueDetailsMap, displayName, value);
      let resolved = det.resolved_image_url || '';
      if (!resolved && det.image_url) resolved = normalizeMediaUrl(det.image_url);
      merged.push({
        value,
        variant_id: variantId,
        value_id: det.id,
        color_code: det.color_code,
        image_url: det.image_url,
        resolved_image_url: resolved || null,
        thumb_url: det.thumb_url ?? null
      });
    };

    for (const o of fromPa) {
      const match = fromV.find(v => normalizeVal(v.value) === normalizeVal(o.value));
      addOpt(o.value, match ? match.variant_id : null);
    }
    for (const o of fromV) {
      addOpt(o.value, o.variant_id);
    }

    if (merged.length === 0 && pa) {
      for (const o of filterPaValues(pa)) {
        addOpt(o.value, null, true);
      }
    }

    if (merged.length === 0) continue;

    groups.push({
      displayName,
      storageKey,
      display_order: displayOrder,
      options: merged.sort(
        (a, b) =>
          (fromPa.findIndex(x => normalizeVal(x.value) === normalizeVal(a.value)) -
            fromPa.findIndex(x => normalizeVal(x.value) === normalizeVal(b.value))) ||
          a.value.localeCompare(b.value)
      )
    });
  }

  groups.sort((a, b) => a.display_order - b.display_order);

  if (groups.length === 0 && variants.length > 0) {
    const byNorm = buildBucketsFromVariants(variants);
    const orderKeys = Array.from(byNorm.keys()).sort();
    for (const nk of orderKeys) {
      const bucket = byNorm.get(nk)!;
      const opts: VariantDisplayOption[] = bucket.options.map(o => {
        const det = getDetailsForOption(valueDetailsMap, bucket.storageKey, o.value);
        let resolved = det.resolved_image_url || '';
        if (!resolved && det.image_url) resolved = normalizeMediaUrl(det.image_url);
        return {
          value: o.value,
          variant_id: o.variant_id,
          value_id: det.id,
          color_code: det.color_code,
          image_url: det.image_url,
          resolved_image_url: resolved || null
        };
      });
      if (opts.length)
        groups.push({
          displayName: bucket.storageKey,
          storageKey: bucket.storageKey,
          display_order: 999,
          options: opts
        });
    }
  }

  return { groups };
}

const COLOR_ATTR_RE = /colou?r/i;

export function isColorAttributeName(name: string | undefined | null): boolean {
  return COLOR_ATTR_RE.test(String(name || ''));
}

/**
 * Color swatches for home/category listings — same Color group as PDP (`buildVariantDisplayModel`),
 * so CMS-selected values (e.g. Green) appear even when not every SKU exists yet, matching the product page.
 */
export function buildColorOptionsForListing(
  product: {
    id: number;
    images?: Array<{
      attribute_value_id?: number | null;
      image_url?: string;
      thumb_url?: string | null;
      thumb_url_db?: string | null;
    }>;
  },
  variants: any[],
  productAttributes: ProductAttribute[]
): Array<{
  value_id: number | null;
  value: string;
  color_code: string | null;
  /** Full image for hero swap on swatch click */
  image_url: string;
  /** Thumb URL for small swatch (may equal image_url if no thumb exists) */
  swatch_image_url: string;
}> {
  if (!variants || variants.length === 0) {
    return [];
  }

  const { groups } = buildVariantDisplayModel(product, variants, productAttributes);
  const colorGroup = groups.find(
    g => isColorAttributeName(g.displayName) || isColorAttributeName(g.storageKey)
  );
  if (!colorGroup || colorGroup.options.length === 0) {
    return [];
  }

  const defaultFull =
    product.images && product.images.length > 0
      ? normalizeMediaUrl(product.images[0].image_url || '')
      : '';

  const out: Array<{
    value_id: number | null;
    value: string;
    color_code: string | null;
    image_url: string;
    swatch_image_url: string;
  }> = [];
  for (const opt of colorGroup.options) {
    let fullUrl = opt.resolved_image_url || '';
    if (!fullUrl && opt.image_url) fullUrl = normalizeMediaUrl(opt.image_url);
    if (!fullUrl) fullUrl = defaultFull;
    if (!fullUrl) continue;

    const swatchUrl = resolveListingThumbUrl(fullUrl, opt.thumb_url ?? null) || fullUrl;

    const vid = opt.value_id != null && opt.value_id > 0 ? opt.value_id : null;
    out.push({
      value_id: vid,
      value: opt.value,
      color_code: opt.color_code,
      image_url: fullUrl,
      swatch_image_url: swatchUrl
    });
  }

  return out;
}
