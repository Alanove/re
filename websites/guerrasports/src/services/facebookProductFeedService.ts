import { db } from '../config/database';
import { EcommerceSettingsService } from '../../admin/services/ecommerceSettingsService';
import { resolveFacebookCatalogContentId } from '../utils/facebookCatalogId';

const G_NS = 'http://base.google.com/ns/1.0';
/** RSS extension namespace for Facebook/Meta channel hints (optional). */
const FB_NS = 'http://www.facebook.com/2008/fbml';

type FeedProductRow = {
  id: number;
  slug: string;
  name: string;
  sku: string | null;
  short_description: string | null;
  description: string | null;
  price: string | number;
  compare_at_price: string | number | null;
  stock_quantity: number;
  track_inventory: boolean | number;
  brand_name: string | null;
};

type FeedVariantRow = {
  id: number;
  product_id: number;
  sku: string | null;
  name: string;
  attributes: string | Record<string, string>;
  price: string | number | null;
  compare_at_price: string | number | null;
  stock_quantity: number;
  track_inventory: boolean | number;
};

type FeedImageRow = {
  product_id: number;
  image_url: string;
  is_primary: boolean | number;
  order_index: number;
};

export type FacebookFeedItem = {
  id: string;
  itemGroupId: string;
  title: string;
  description: string;
  availability: string;
  condition: string;
  price: string;
  link: string;
  imageLink: string;
  brand: string;
  size: string;
  color: string;
  salePrice: string;
  additionalImageUrls: string[];
};

function toNum(v: string | number | null | undefined): number {
  if (v === null || v === undefined || v === '') return NaN;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : NaN;
}

function stripHtmlToPlainText(html: string | null | undefined): string {
  if (!html) return '';
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizePublicPath(url: string): string {
  let u = url.trim().replace(/\\/g, '/');
  if (!u) return '';
  if (/^https?:\/\//i.test(u) || u.startsWith('//')) return u;
  if (!u.startsWith('/')) u = '/' + u;
  return u.replace(/\/+/g, '/');
}

export function toAbsoluteProductUrl(baseUrl: string, relativeOrAbsolute: string): string | null {
  const p = normalizePublicPath(relativeOrAbsolute);
  if (!p) return null;
  if (/^https?:\/\//i.test(p)) return p;
  const base = baseUrl.replace(/\/$/, '');
  return `${base}${p}`;
}

function parseVariantAttributes(raw: string | Record<string, string>): Record<string, string> {
  if (!raw) return {};
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
    return Object.fromEntries(
      Object.entries(raw).map(([k, v]) => [k, v == null ? '' : String(v)])
    );
  }
  try {
    const o = JSON.parse(String(raw));
    if (o && typeof o === 'object' && !Array.isArray(o)) {
      return Object.fromEntries(
        Object.entries(o).map(([k, v]) => [k, v == null ? '' : String(v)])
      );
    }
  } catch {
    /* ignore */
  }
  return {};
}

function attributeValue(attrs: Record<string, string>, ...keys: string[]): string {
  const lowerMap = new Map<string, string>();
  for (const [k, v] of Object.entries(attrs)) {
    lowerMap.set(k.toLowerCase(), v);
  }
  for (const key of keys) {
    const v = lowerMap.get(key.toLowerCase());
    if (v && v.trim()) return v.trim();
  }
  return '';
}

function normAttrKey(s: string): string {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ');
}

/** True when this variant type represents sizing (slug/name from CMS). */
function isSizeVariantType(slug: string | null | undefined, name: string | null | undefined): boolean {
  const s = (slug || '').toLowerCase().replace(/_/g, '-');
  const n = (name || '').toLowerCase();
  if (
    /(^|[-])(size|sizes|taille|talla|pointure|inseam|waist)([-]|$)/.test(s) ||
    s.includes('shoe-size') ||
    s.includes('shoes-size')
  ) {
    return true;
  }
  if (/\bsize\b|sizes|taille|talla|pointure|inseam|waist|\bshoe size\b/.test(n)) {
    return true;
  }
  return false;
}

function isLikelySizeToken(token: string, colorValue: string): boolean {
  const t = token.trim();
  if (!t || t.length > 40) return false;
  const c = (colorValue || '').trim().toLowerCase();
  if (c && t.toLowerCase() === c) return false;
  if (/^(xxs|2xs|xs|s|m|l|xl|xxl|xxxl|xxxxl|4xl|one[\s-]?size|os|osfa|u\/s|a\/l)$/i.test(t)) {
    return true;
  }
  if (/^(small|medium|large|x-?large|x-?small|extra[\s-]?large|extra[\s-]?small)$/i.test(t)) {
    return true;
  }
  if (/^(US|UK|EU)\s?\d{1,2}(\.\d)?$/i.test(t)) return true;
  if (/^\d{1,2}(\.\d)?$/.test(t)) return true;
  if (/^\d{1,2}[-/]\d{1,2}$/.test(t)) return true;
  return false;
}

/** Parse variant display name when size is not in JSON (e.g. "Black — L", "Royal Blue / M"). */
function inferSizeFromVariantName(variantName: string, colorValue: string): string {
  const n = variantName.trim();
  if (!n) return '';
  const seps = [' — ', ' – ', ' - ', ' / ', '|'];
  let parts: string[] = [n];
  for (const sep of seps) {
    if (n.includes(sep)) {
      parts = n.split(sep).map(s => s.trim()).filter(Boolean);
      break;
    }
  }
  if (parts.length >= 2) {
    const c = (colorValue || '').trim().toLowerCase();
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      if (!p) continue;
      if (c && p.toLowerCase() === c) continue;
      if (isLikelySizeToken(p, colorValue)) return p;
    }
    return '';
  }
  if (parts.length === 1 && isLikelySizeToken(parts[0], colorValue)) return parts[0];
  return '';
}

function extractSizeFromAttributes(
  attrs: Record<string, string>,
  sizeKeyHints: Set<string>
): string {
  const directKeys = [
    'size',
    'sizes',
    'taille',
    'talla',
    'pointure',
    'shoe size',
    'shoes size',
    'waist',
    'inseam',
    'length'
  ];
  for (const k of directKeys) {
    const v = attributeValue(attrs, k);
    if (v) return v;
  }
  const sortedKeys = Object.keys(attrs).sort();
  for (const k of sortedKeys) {
    if (sizeKeyHints.has(normAttrKey(k))) {
      const v = attrs[k]?.trim();
      if (v) return v;
    }
  }
  for (const k of sortedKeys) {
    if (/\bsize\b|taille|talla|pointure|waist|inseam|shoe|length\b/i.test(k)) {
      const v = attrs[k]?.trim();
      if (v) return v;
    }
  }
  return '';
}

function resolveVariantSize(
  attrs: Record<string, string>,
  variantName: string,
  colorValue: string,
  sizeKeyHints: Set<string>
): string {
  const fromAttrs = extractSizeFromAttributes(attrs, sizeKeyHints);
  if (fromAttrs) return fromAttrs.slice(0, 200);
  const fromName = inferSizeFromVariantName(variantName, colorValue);
  return fromName.slice(0, 200);
}

function tracksStock(track: boolean | number | undefined): boolean {
  return track === true || track === 1;
}

function availabilityInStock(trackInventory: boolean | number | undefined, qty: number): string {
  if (!tracksStock(trackInventory)) return 'in stock';
  return qty > 0 ? 'in stock' : 'out of stock';
}

function allocateUniqueId(candidate: string, used: Set<string>): string {
  let base = candidate.trim().slice(0, 100) || 'item';
  let id = base;
  let n = 2;
  while (used.has(id)) {
    const suffix = `-${n}`;
    id = (base.slice(0, Math.max(1, 100 - suffix.length)) + suffix).slice(0, 100);
    n++;
  }
  used.add(id);
  return id;
}

function xmlEscapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function gTag(localName: string, value: string): string {
  return `<g:${localName}>${xmlEscapeText(value)}</g:${localName}>`;
}

/** Standard RSS 2.0 elements (no namespace), alongside Google/Meta product extensions. */
function rssElem(localName: string, value: string): string {
  return `<${localName}>${xmlEscapeText(value)}</${localName}>`;
}

export interface FacebookFeedBuildOptions {
  baseUrl: string;
  currencyCode: string;
  fallbackBrand: string;
  /** RSS channel title (defaults to fallbackBrand). */
  channelTitle?: string;
  /** Optional digits-only Facebook App ID (channel-level fb:app_id when present). */
  facebookAppId?: string;
}

export interface FacebookFeedBuildResult {
  xml: string;
  rowCount: number;
}

/**
 * Collects catalog rows for Meta Commerce Manager (field semantics per
 * https://www.facebook.com/business/help/120325381656392 ).
 */
export async function collectFacebookFeedItems(options: FacebookFeedBuildOptions): Promise<FacebookFeedItem[]> {
  const { baseUrl, currencyCode, fallbackBrand } = options;
  const currency = (currencyCode || 'USD').trim().toUpperCase().slice(0, 3);

  const [productRows] = await db.query<FeedProductRow>(
    `SELECT p.id, p.slug, p.name, p.sku, p.short_description, p.description, p.price, p.compare_at_price,
            p.stock_quantity, p.track_inventory, b.name AS brand_name
     FROM products p
     LEFT JOIN brands b ON p.brand_id = b.id AND b.is_active = TRUE
     WHERE p.status = 'published' AND p.is_active = TRUE AND p.include_in_auto_ads = TRUE
     ORDER BY p.id ASC`
  );

  if (!productRows.length) return [];

  const productIds = productRows.map(p => p.id);
  const inList = productIds.map(() => '?').join(',');

  const [variantRows] = await db.query<FeedVariantRow>(
    `SELECT id, product_id, sku, name, attributes, price, compare_at_price, stock_quantity, track_inventory
     FROM product_variants
     WHERE product_id IN (${inList}) AND is_active = TRUE
     ORDER BY product_id ASC, is_default DESC, id ASC`,
    productIds
  );

  const [imageRows] = await db.query<FeedImageRow>(
    `SELECT product_id, image_url, is_primary, order_index
     FROM product_images
     WHERE product_id IN (${inList})
     ORDER BY product_id ASC, is_primary DESC, order_index ASC, id ASC`,
    productIds
  );

  const variantsByProduct = new Map<number, FeedVariantRow[]>();
  for (const v of variantRows) {
    const list = variantsByProduct.get(v.product_id) || [];
    list.push(v);
    variantsByProduct.set(v.product_id, list);
  }

  const imagesByProduct = new Map<number, FeedImageRow[]>();
  for (const img of imageRows) {
    const list = imagesByProduct.get(img.product_id) || [];
    list.push(img);
    imagesByProduct.set(img.product_id, list);
  }

  const [vtRows] = await db.query<{ id: number; slug: string; name: string }>(
    `SELECT id, slug, name FROM variant_types WHERE is_active = TRUE`
  );
  const sizeTypeIds: number[] = [];
  const sizeTypeIdSet = new Set<number>();
  const sizeKeyHints = new Set<string>();
  for (const vt of vtRows) {
    if (!isSizeVariantType(vt.slug, vt.name)) continue;
    if (!sizeTypeIdSet.has(vt.id)) {
      sizeTypeIdSet.add(vt.id);
      sizeTypeIds.push(vt.id);
    }
    if (vt.name) sizeKeyHints.add(normAttrKey(vt.name));
    if (vt.slug) {
      sizeKeyHints.add(normAttrKey(vt.slug.replace(/-/g, ' ')));
      sizeKeyHints.add(normAttrKey(vt.slug));
    }
  }

  const productIdsNoVariants = productRows
    .filter(row => (variantsByProduct.get(row.id) || []).length === 0)
    .map(row => row.id);

  const standaloneSizeByProductId = new Map<number, string>();
  if (sizeTypeIds.length > 0 && productIdsNoVariants.length > 0) {
    const inProducts = productIdsNoVariants.map(() => '?').join(',');
    const inTypes = sizeTypeIds.map(() => '?').join(',');
    const [sizeAttrRows] = await db.query<{ product_id: number; value: string }>(
      `SELECT pa.product_id, vtv.value
       FROM product_attributes pa
       INNER JOIN variant_type_values vtv
         ON vtv.variant_type_id = pa.variant_type_id
         AND vtv.is_active = TRUE
         AND JSON_CONTAINS(pa.selected_values, CAST(vtv.id AS JSON))
       WHERE pa.product_id IN (${inProducts})
         AND pa.variant_type_id IN (${inTypes})
       ORDER BY pa.product_id ASC, vtv.display_order ASC, vtv.id ASC`,
      [...productIdsNoVariants, ...sizeTypeIds]
    );
    for (const r of sizeAttrRows) {
      if (!standaloneSizeByProductId.has(r.product_id)) {
        const v = String(r.value || '').trim();
        if (v) standaloneSizeByProductId.set(r.product_id, v.slice(0, 200));
      }
    }
  }

  const usedIds = new Set<string>();
  const items: FacebookFeedItem[] = [];

  for (const p of productRows) {
    const brand = (p.brand_name && p.brand_name.trim()) || fallbackBrand;
    const productLink = `${baseUrl.replace(/\/$/, '')}/shop/product/${encodeURIComponent(p.slug)}`;
    const images = imagesByProduct.get(p.id) || [];
    const primaryRel = images.length > 0 ? normalizePublicPath(images[0].image_url || '') : '';
    const imageAbs = primaryRel ? toAbsoluteProductUrl(baseUrl, primaryRel) : null;
    if (!imageAbs) continue;

    const extras = images
      .slice(1, 11)
      .map(im => toAbsoluteProductUrl(baseUrl, normalizePublicPath(im.image_url || '')))
      .filter((u): u is string => !!u);

    const variants = variantsByProduct.get(p.id) || [];
    const titleBase = (p.name || 'Product').trim().slice(0, 200);

    const makeDescription = (): string => {
      let text = stripHtmlToPlainText(p.description);
      if (!text) text = stripHtmlToPlainText(p.short_description);
      if (!text || text.toLowerCase() === titleBase.toLowerCase()) {
        text = `${titleBase}. Product details and purchasing options are available on our store.`;
      }
      return text.slice(0, 9999);
    };
    const description = makeDescription();
    const groupId = `grp_${p.id}`;

    if (variants.length > 0) {
      for (const v of variants) {
        const attrs = parseVariantAttributes(v.attributes);
        const color = attributeValue(attrs, 'color', 'colour');
        const variantLabel = (v.name || '').trim();
        const size = resolveVariantSize(attrs, variantLabel, color, sizeKeyHints);
        const title = variantLabel ? `${titleBase} — ${variantLabel}`.slice(0, 200) : titleBase;

        const priceVal = toNum(v.price);
        const productPrice = toNum(p.price);
        const effectivePrice = Number.isFinite(priceVal) ? priceVal : productPrice;
        if (!Number.isFinite(effectivePrice)) continue;

        const compare = toNum(v.compare_at_price ?? p.compare_at_price);
        let salePrice = '';
        let listPrice = effectivePrice;
        if (Number.isFinite(compare) && compare > effectivePrice) {
          listPrice = compare;
          salePrice = `${effectivePrice.toFixed(2)} ${currency}`;
        }
        const priceStr = `${listPrice.toFixed(2)} ${currency}`;
        const avail = availabilityInStock(v.track_inventory, Number(v.stock_quantity) || 0);
        const skuCandidate = resolveFacebookCatalogContentId({
          productId: p.id,
          variantId: v.id,
          productSku: p.sku,
          variantSku: v.sku
        });
        const rowId = allocateUniqueId(skuCandidate, usedIds);

        items.push({
          id: rowId,
          itemGroupId: groupId,
          title,
          description,
          availability: avail,
          condition: 'new',
          price: priceStr,
          link: productLink,
          imageLink: imageAbs,
          brand,
          size,
          color,
          salePrice,
          additionalImageUrls: extras
        });
      }
    } else {
      const effectivePrice = toNum(p.price);
      if (!Number.isFinite(effectivePrice)) continue;

      const compare = toNum(p.compare_at_price);
      let salePrice = '';
      let listPrice = effectivePrice;
      if (Number.isFinite(compare) && compare > effectivePrice) {
        listPrice = compare;
        salePrice = `${effectivePrice.toFixed(2)} ${currency}`;
      }
      const priceStr = `${listPrice.toFixed(2)} ${currency}`;
      const avail = availabilityInStock(p.track_inventory, Number(p.stock_quantity) || 0);
      const skuCandidate = resolveFacebookCatalogContentId({
        productId: p.id,
        productSku: p.sku
      });
      const rowId = allocateUniqueId(skuCandidate, usedIds);

      items.push({
        id: rowId,
        itemGroupId: '',
        title: titleBase,
        description,
        availability: avail,
        condition: 'new',
        price: priceStr,
        link: productLink,
        imageLink: imageAbs,
        brand,
        size: standaloneSizeByProductId.get(p.id) || '',
        color: '',
        salePrice,
        additionalImageUrls: extras
      });
    }
  }

  return items;
}

/**
 * RSS 2.0 + Google product namespace (supported by Meta catalog uploads).
 */
export function buildFacebookProductFeedRssXml(
  items: FacebookFeedItem[],
  channelTitle: string,
  channelLink: string,
  rssOpts?: { facebookAppId?: string }
): string {
  const title = xmlEscapeText(channelTitle || 'Product catalog');
  const link = xmlEscapeText(channelLink.replace(/\/$/, ''));
  const desc = xmlEscapeText(`Product feed for ${channelLink}`);
  const appId = String(rssOpts?.facebookAppId || '').replace(/\D/g, '').trim();

  const itemBlocks = items.map(it => {
    const parts: string[] = [
      '    <item>',
      `      ${rssElem('title', it.title)}`,
      `      ${rssElem('link', it.link)}`,
      `      ${rssElem('description', it.description)}`,
      `      ${gTag('id', it.id)}`,
      `      ${gTag('title', it.title)}`,
      `      ${gTag('description', it.description)}`,
      `      ${gTag('link', it.link)}`,
      `      ${gTag('image_link', it.imageLink)}`,
      `      ${gTag('availability', it.availability)}`,
      `      ${gTag('condition', it.condition)}`,
      `      ${gTag('price', it.price)}`,
      `      ${gTag('brand', it.brand)}`
    ];
    if (it.itemGroupId) parts.push(`      ${gTag('item_group_id', it.itemGroupId)}`);
    if (it.size) parts.push(`      ${gTag('size', it.size)}`);
    if (it.color) parts.push(`      ${gTag('color', it.color)}`);
    if (it.salePrice) parts.push(`      ${gTag('sale_price', it.salePrice)}`);
    for (const u of it.additionalImageUrls) {
      parts.push(`      ${gTag('additional_image_link', u)}`);
    }
    parts.push('    </item>');
    return parts.join('\n');
  });

  const rssTag = appId
    ? `<rss version="2.0" xmlns:g="${G_NS}" xmlns:fb="${FB_NS}">`
    : `<rss version="2.0" xmlns:g="${G_NS}">`;
  const fbChannelExtra = appId ? [`    <fb:app_id>${xmlEscapeText(appId)}</fb:app_id>`] : [];

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    rssTag,
    '  <channel>',
    `    <title>${title}</title>`,
    `    <link>${link}</link>`,
    `    <description>${desc}</description>`,
    ...fbChannelExtra,
    ...itemBlocks,
    '  </channel>',
    '</rss>',
    ''
  ].join('\n');

  return body;
}

export async function buildFacebookProductFeedXml(options: FacebookFeedBuildOptions): Promise<FacebookFeedBuildResult> {
  const items = await collectFacebookFeedItems(options);
  const base = options.baseUrl.replace(/\/$/, '');
  const channelTitle =
    (options.channelTitle && options.channelTitle.trim()) || options.fallbackBrand || 'Store';
  const fbApp = String(options.facebookAppId || '').replace(/\D/g, '').trim();
  const xml = buildFacebookProductFeedRssXml(
    items,
    channelTitle,
    base,
    fbApp ? { facebookAppId: fbApp } : undefined
  );
  return { xml, rowCount: items.length };
}

export async function buildFacebookProductFeedWithStoreSettings(baseUrl: string): Promise<FacebookFeedBuildResult> {
  const settings = await EcommerceSettingsService.getInstance().getSettings();
  const currency = (settings.currency || 'USD').trim() || 'USD';
  const storeLabel = (settings.store_name || 'Store').trim() || 'Store';
  const facebookAppId = String(settings.facebook_app_id || '').replace(/\D/g, '').trim();
  return buildFacebookProductFeedXml({
    baseUrl,
    currencyCode: currency,
    fallbackBrand: storeLabel,
    channelTitle: storeLabel,
    ...(facebookAppId ? { facebookAppId } : {})
  });
}
